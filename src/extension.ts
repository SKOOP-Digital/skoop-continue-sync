import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as YAML from 'yaml';

export function activate(context: vscode.ExtensionContext) {
    console.log('Skoop Continue Sync extension is now active!');

    const disposable = vscode.commands.registerCommand('skoop-continue-sync.applyTeamSettings', async () => {
        try {
            await applyTeamSettings();
            vscode.window.showInformationMessage('Team Continue settings applied successfully!');
        } catch (error) {
            console.error('Error applying team settings:', error);
            vscode.window.showErrorMessage(`Failed to apply team settings: ${error}`);
        }
    });

    context.subscriptions.push(disposable);
}

interface ModelConfig {
    provider?: string;
    model: string;
    apiBase?: string;
    apiKey?: string;
    title?: string;
    roles?: string[];
    isDefault?: boolean;
    [key: string]: any;
}

interface AgentConfig {
    name: string;
    description?: string;
    model: string;
    tools?: string[];
    prompt?: string;
    [key: string]: any;
}

interface RuleConfig {
    name: string;
    description?: string;
    rule: string;
    [key: string]: any;
}

interface PromptConfig {
    name: string;
    description?: string;
    prompt: string;
    [key: string]: any;
}

interface ContinueConfig {
    models?: ModelConfig[];
    agents?: AgentConfig[];
    rules?: RuleConfig[];
    prompts?: PromptConfig[];
    [key: string]: any;
}

async function applyTeamSettings() {
    const configPath = await findContinueConfigPath();
    if (!configPath) {
        throw new Error('Could not find Continue.dev config file. Please make sure Continue is installed and configured.');
    }

    let config: ContinueConfig = {};

    // Read existing config if it exists
    if (fs.existsSync(configPath)) {
        const configContent = fs.readFileSync(configPath, 'utf8');
        config = YAML.parse(configContent) || {};
    }

    // Apply team settings
    config = applyLiteLLMSettings(config);
    config = applyModelSettings(config);
    config = applyAgentSettings(config);
    config = applyRulesAndPrompts(config);

    // Write updated config
    const yamlContent = YAML.stringify(config, { indent: 2 });
    fs.writeFileSync(configPath, yamlContent, 'utf8');

    console.log('Continue config updated at:', configPath);
}

async function findContinueConfigPath(): Promise<string | null> {
    // Try to find Continue config in common locations
    const possiblePaths = [
        path.join(vscode.workspace.rootPath || '', '.continue', 'config.yaml'),
        path.join(vscode.workspace.rootPath || '', '.continue', 'config.json'),
        path.join(process.env.HOME || '', '.continue', 'config.yaml'),
        path.join(process.env.HOME || '', '.continue', 'config.json'),
        path.join(process.env.USERPROFILE || '', '.continue', 'config.yaml'),
        path.join(process.env.USERPROFILE || '', '.continue', 'config.json'),
    ];

    for (const configPath of possiblePaths) {
        if (fs.existsSync(configPath)) {
            return configPath;
        }
    }

    // If no existing config found, create one in the workspace
    if (vscode.workspace.rootPath) {
        const workspaceConfigPath = path.join(vscode.workspace.rootPath, '.continue', 'config.yaml');
        const continueDir = path.dirname(workspaceConfigPath);
        if (!fs.existsSync(continueDir)) {
            fs.mkdirSync(continueDir, { recursive: true });
        }
        return workspaceConfigPath;
    }

    return null;
}

function applyLiteLLMSettings(config: ContinueConfig): ContinueConfig {
    const litellmUrl = vscode.workspace.getConfiguration('skoop-continue-sync').get('litellmUrl', 'https://litellm.skoop.digital/');
    const litellmApiKey = vscode.workspace.getConfiguration('skoop-continue-sync').get('litellmApiKey', 'sk-Phkcy9C76yAAc2rNAAsnlg');

    // Initialize models array if it doesn't exist
    if (!config.models) {
        config.models = [];
    }

    // Add LiteLLM provider if not already present
    const existingProviderIndex = config.models.findIndex((m: ModelConfig) =>
        m.provider === 'openai' && m.apiBase?.includes('litellm.skoop.digital')
    );

    const litellmProvider = {
        provider: 'openai',
        model: 'gpt-4',
        apiBase: litellmUrl,
        apiKey: litellmApiKey,
        title: 'LiteLLM Server'
    };

    if (existingProviderIndex === -1) {
        config.models.push(litellmProvider);
    } else {
        config.models[existingProviderIndex] = litellmProvider;
    }

    // Add specific models from LiteLLM
    const teamModels = [
        {
            provider: 'openai',
            model: 'openai/gpt-5-mini',
            apiBase: litellmUrl,
            apiKey: litellmApiKey,
            title: 'GPT-5 Mini (Team)',
            roles: ['chat', 'autocomplete']
        },
        {
            provider: 'openai',
            model: 'gemini/gemini-2.5-flash',
            apiBase: litellmUrl,
            apiKey: litellmApiKey,
            title: 'Gemini 2.5 Flash (Team)',
            roles: ['chat', 'edit']
        },
        {
            provider: 'openai',
            model: 'anthropic/claude-4-sonnet-20250514',
            apiBase: litellmUrl,
            apiKey: litellmApiKey,
            title: 'Claude 4 Sonnet (Team)',
            roles: ['agent', 'chat']
        }
    ];

    // Add team models if they don't exist
    for (const teamModel of teamModels) {
        const existingModelIndex = config.models.findIndex((m: ModelConfig) =>
            m.model === teamModel.model && m.apiBase === teamModel.apiBase
        );

        if (existingModelIndex === -1) {
            config.models.push(teamModel);
        }
    }

    return config;
}

function applyModelSettings(config: ContinueConfig): ContinueConfig {
    // Set default models for different roles
    config.models = config.models || [];

    // Set primary chat model
    const chatModelIndex = config.models.findIndex((m: ModelConfig) =>
        m.model === 'openai/gpt-5-mini' && m.roles?.includes('chat')
    );
    if (chatModelIndex !== -1) {
        config.models[chatModelIndex].isDefault = true;
    }

    return config;
}

function applyAgentSettings(config: ContinueConfig): ContinueConfig {
    // Define team agents
    config.agents = config.agents || [];

    const teamAgents = [
        {
            name: 'CodeReviewer',
            description: 'Agent for code review tasks',
            model: 'anthropic/claude-4-sonnet-20250514',
            tools: ['read_file', 'run_terminal_cmd'],
            prompt: 'You are a senior developer reviewing code for quality, security, and best practices.'
        },
        {
            name: 'BugFixer',
            description: 'Agent for debugging and fixing issues',
            model: 'gemini/gemini-2.5-flash',
            tools: ['read_file', 'grep', 'run_terminal_cmd'],
            prompt: 'You are an expert debugger. Analyze code, find bugs, and provide fixes with explanations.'
        },
        {
            name: 'DocumentationWriter',
            description: 'Agent for writing and updating documentation',
            model: 'openai/gpt-5-mini',
            tools: ['read_file', 'search_replace'],
            prompt: 'You are a technical writer. Create clear, comprehensive documentation for code and APIs.'
        }
    ];

    // Add agents if they don't exist
    for (const agent of teamAgents) {
        const existingAgentIndex = config.agents.findIndex((a: AgentConfig) => a.name === agent.name);
        if (existingAgentIndex === -1) {
            config.agents.push(agent);
        } else {
            config.agents[existingAgentIndex] = agent;
        }
    }

    return config;
}

function applyRulesAndPrompts(config: ContinueConfig): ContinueConfig {
    // Apply global rules
    config.rules = config.rules || [];

    const teamRules = [
        {
            name: 'CodeStyle',
            description: 'Enforce team coding standards',
            rule: 'Always use TypeScript with strict type checking. Follow ESLint rules. Use meaningful variable names.'
        },
        {
            name: 'Security',
            description: 'Security best practices',
            rule: 'Never commit API keys or sensitive data. Use environment variables for secrets. Validate all user inputs.'
        },
        {
            name: 'Documentation',
            description: 'Documentation requirements',
            rule: 'Add JSDoc comments to all public functions. Update README for any API changes.'
        }
    ];

    // Add rules if they don't exist
    for (const rule of teamRules) {
        const existingRuleIndex = config.rules.findIndex((r: RuleConfig) => r.name === rule.name);
        if (existingRuleIndex === -1) {
            config.rules.push(rule);
        } else {
            config.rules[existingRuleIndex] = rule;
        }
    }

    // Apply global prompts
    config.prompts = config.prompts || [];

    const teamPrompts = [
        {
            name: 'CodeReview',
            description: 'Standard code review prompt',
            prompt: 'Please review this code for:\n1. Code quality and readability\n2. Security vulnerabilities\n3. Performance issues\n4. Best practices\n5. Test coverage\n\nProvide specific suggestions for improvement.'
        },
        {
            name: 'BugReport',
            description: 'Bug report analysis prompt',
            prompt: 'Analyze this bug report:\n1. Reproduce the issue\n2. Identify the root cause\n3. Suggest a fix\n4. Consider edge cases\n5. Update tests if needed'
        }
    ];

    // Add prompts if they don't exist
    for (const prompt of teamPrompts) {
        const existingPromptIndex = config.prompts.findIndex((p: PromptConfig) => p.name === prompt.name);
        if (existingPromptIndex === -1) {
            config.prompts.push(prompt);
        } else {
            config.prompts[existingPromptIndex] = prompt;
        }
    }

    return config;
}

export function deactivate() {}
