import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    console.log('[Skoop Continue Sync] Extension activated successfully!');
    console.log('[Skoop Continue Sync] Current workspace:', vscode.workspace.rootPath);
    console.log('[Skoop Continue Sync] Process environment:', {
        HOME: process.env.HOME,
        USERPROFILE: process.env.USERPROFILE,
        APPDATA: process.env.APPDATA
    });

    const disposable = vscode.commands.registerCommand('skoop-continue-sync.applyTeamSettings', async () => {
        console.log('[Skoop Continue Sync] Apply team settings command triggered');

        try {
            console.log('[Skoop Continue Sync] Starting to apply team settings...');
            await applyTeamSettings();
            console.log('[Skoop Continue Sync] Team settings applied successfully');
            vscode.window.showInformationMessage('Team Continue settings applied successfully!');
        } catch (error) {
            console.error('[Skoop Continue Sync] Error applying team settings:', error);
            vscode.window.showErrorMessage(`Failed to apply team settings: ${error}`);
        }
    });

    context.subscriptions.push(disposable);
    console.log('[Skoop Continue Sync] Command registered: skoop-continue-sync.applyTeamSettings');
}

interface ModelConfig {
    provider?: string;
    model: string;
    apiBase?: string;
    apiKey?: string;
    title?: string;
    roles?: string[];
    isDefault?: boolean;
    [key: string]: string | string[] | boolean | undefined;
}

interface AgentConfig {
    name: string;
    description?: string;
    model: string;
    tools?: string[];
    prompt?: string;
    [key: string]: string | string[] | undefined;
}

interface RuleConfig {
    name: string;
    description?: string;
    rule: string;
    [key: string]: string | undefined;
}

interface PromptConfig {
    name: string;
    description?: string;
    prompt: string;
    [key: string]: string | undefined;
}

interface ContinueConfig {
    name?: string;
    version?: string;
    schema?: string;
    models?: ModelConfig[];
    agents?: AgentConfig[];
    rules?: RuleConfig[];
    prompts?: PromptConfig[];
    [key: string]: string | ModelConfig[] | AgentConfig[] | RuleConfig[] | PromptConfig[] | undefined;
}

async function applyTeamSettings() {
    console.log('[Skoop Continue Sync] Finding Continue config path...');
    const configPath = await findContinueConfigPath();
    if (!configPath) {
        console.error('[Skoop Continue Sync] Could not find Continue.dev config file');
        throw new Error('Could not find Continue.dev config file. Please make sure Continue is installed and configured.');
    }
    console.log('[Skoop Continue Sync] Found config path:', configPath);

    let config: ContinueConfig = {};

    // Initialize with clean config instead of trying to parse existing (potentially malformed) config
    console.log('[Skoop Continue Sync] Initializing with clean team configuration');
    config = {
        name: "Skoop Team Agent",
        version: "1.0.0",
        schema: "v1",
        models: [],
        agents: [],
        rules: [],
        prompts: []
    };
    console.log('[Skoop Continue Sync] Initialized clean config');

    // Apply team settings
    console.log('[Skoop Continue Sync] Applying LiteLLM settings...');
    config = applyLiteLLMSettings(config);
    console.log('[Skoop Continue Sync] Applying model settings...');
    config = applyModelSettings(config);
    console.log('[Skoop Continue Sync] Applying agent settings...');
    config = applyAgentSettings(config);
    console.log('[Skoop Continue Sync] Applying rules and prompts...');
    config = applyRulesAndPrompts(config);

    // Write updated config
    console.log('[Skoop Continue Sync] Writing updated config...');
    try {
        const yamlContent = configToYaml(config);
        console.log('[Skoop Continue Sync] Generated YAML content length:', yamlContent.length);
        console.log('[Skoop Continue Sync] Final config to write:', yamlContent);
        fs.writeFileSync(configPath, yamlContent, 'utf8');
        console.log('[Skoop Continue Sync] Config written successfully to:', configPath);
    } catch (error) {
        console.error('[Skoop Continue Sync] Error writing config:', error);
        throw error;
    }
}

async function findContinueConfigPath(): Promise<string | null> {
    console.log('[Skoop Continue Sync] Searching for Continue config file...');

    // Try to find Continue config in common locations (prefer JSON over YAML)
    const possiblePaths = [
        path.join(vscode.workspace.rootPath || '', '.continue', 'config.json'),
        path.join(vscode.workspace.rootPath || '', '.continue', 'config.yaml'),
        path.join(process.env.HOME || '', '.continue', 'config.json'),
        path.join(process.env.HOME || '', '.continue', 'config.yaml'),
        path.join(process.env.USERPROFILE || '', '.continue', 'config.json'),
        path.join(process.env.USERPROFILE || '', '.continue', 'config.yaml'),
    ];

    console.log('[Skoop Continue Sync] Checking possible config paths:');
    for (const configPath of possiblePaths) {
        console.log(`[Skoop Continue Sync]   Checking: ${configPath}`);
        console.log(`[Skoop Continue Sync]   Exists: ${fs.existsSync(configPath)}`);
        if (fs.existsSync(configPath)) {
            console.log(`[Skoop Continue Sync]   Found existing config at: ${configPath}`);
            return configPath;
        }
    }

    console.log('[Skoop Continue Sync] No existing config found, will create new one');

    // If no existing config found, create one in the workspace
    if (vscode.workspace.rootPath) {
        const workspaceConfigPath = path.join(vscode.workspace.rootPath, '.continue', 'config.json');
        console.log(`[Skoop Continue Sync] Creating new config at workspace: ${workspaceConfigPath}`);
        const continueDir = path.dirname(workspaceConfigPath);
        console.log(`[Skoop Continue Sync] Creating directory if needed: ${continueDir}`);
        if (!fs.existsSync(continueDir)) {
            try {
                fs.mkdirSync(continueDir, { recursive: true });
                console.log('[Skoop Continue Sync] Directory created successfully');
            } catch (error) {
                console.error('[Skoop Continue Sync] Error creating directory:', error);
                return null;
            }
        }
        console.log(`[Skoop Continue Sync] Will use new config path: ${workspaceConfigPath}`);
        return workspaceConfigPath;
    }

    console.error('[Skoop Continue Sync] No workspace root path found, cannot create config');
    return null;
}

function applyLiteLLMSettings(config: ContinueConfig): ContinueConfig {
    console.log('[Skoop Continue Sync] Reading VS Code configuration...');
    const litellmUrl = vscode.workspace.getConfiguration('skoop-continue-sync').get('litellmUrl', 'https://litellm.skoop.digital/');
    const litellmApiKey = vscode.workspace.getConfiguration('skoop-continue-sync').get('litellmApiKey', 'sk-Phkcy9C76yAAc2rNAAsnlg');

    console.log('[Skoop Continue Sync] LiteLLM URL:', litellmUrl);
    console.log('[Skoop Continue Sync] LiteLLM API Key length:', litellmApiKey.length);

    // Models array is already initialized as empty array
    console.log('[Skoop Continue Sync] Models array initialized:', config.models!.length);

    // Add LiteLLM provider if not already present
    const existingProviderIndex = config.models!.findIndex((m: ModelConfig) =>
        m.provider === 'openai' && m.apiBase?.includes('litellm.skoop.digital')
    );
    console.log('[Skoop Continue Sync] Existing LiteLLM provider index:', existingProviderIndex);

    const litellmProvider = {
        provider: 'openai',
        model: 'gpt-4o-mini',
        apiBase: litellmUrl,
        apiKey: litellmApiKey,
        title: 'LiteLLM Server'
    };

    if (existingProviderIndex === -1) {
        console.log('[Skoop Continue Sync] Adding new LiteLLM provider');
        config.models!.push(litellmProvider);
    } else {
        console.log('[Skoop Continue Sync] Updating existing LiteLLM provider');
        config.models![existingProviderIndex] = litellmProvider;
    }

    // Add specific models from LiteLLM - all use openai provider for LiteLLM routing
    const teamModels = [
        {
            provider: 'openai',
            model: 'openai/gpt-4o-mini',
            apiBase: litellmUrl,
            apiKey: litellmApiKey,
            title: 'GPT-4o Mini (Team)',
            roles: ['chat', 'autocomplete']
        },
        {
            provider: 'openai',
            model: 'gemini/gemini-1.5-flash',
            apiBase: litellmUrl,
            apiKey: litellmApiKey,
            title: 'Gemini 1.5 Flash (Team)',
            roles: ['chat', 'edit']
        },
        {
            provider: 'openai',
            model: 'anthropic/claude-3-5-sonnet-20241022',
            apiBase: litellmUrl,
            apiKey: litellmApiKey,
            title: 'Claude 3.5 Sonnet (Team)',
            roles: ['agent', 'chat']
        }
    ];

    console.log('[Skoop Continue Sync] Adding team models...');
    // Add team models if they don't exist
    for (const teamModel of teamModels) {
        const existingModelIndex = config.models!.findIndex((m: ModelConfig) =>
            m.model === teamModel.model && m.apiBase === teamModel.apiBase && m.provider === teamModel.provider
        );

        console.log(`[Skoop Continue Sync]   ${teamModel.title}: ${existingModelIndex === -1 ? 'Adding' : 'Already exists'}`);
        if (existingModelIndex === -1) {
            config.models!.push(teamModel);
        }
    }

    console.log('[Skoop Continue Sync] Final models count:', config.models!.length);
    return config;
}

function applyModelSettings(config: ContinueConfig): ContinueConfig {
    console.log('[Skoop Continue Sync] Setting default models...');
    console.log('[Skoop Continue Sync] Models before setting defaults:', config.models!.length);

    // Set primary chat model
    const chatModelIndex = config.models!.findIndex((m: ModelConfig) =>
        m.model === 'openai/gpt-4o-mini' && m.roles?.includes('chat')
    );
    console.log('[Skoop Continue Sync] Chat model index:', chatModelIndex);
    if (chatModelIndex !== -1) {
        config.models![chatModelIndex].isDefault = true;
        console.log('[Skoop Continue Sync] Set GPT-4o Mini as default chat model');
    }

    return config;
}

function applyAgentSettings(config: ContinueConfig): ContinueConfig {
    console.log('[Skoop Continue Sync] Applying agent settings...');
    console.log('[Skoop Continue Sync] Existing agents count:', config.agents!.length);

    const teamAgents = [
        {
            name: 'CodeReviewer',
            description: 'Agent for code review tasks',
            model: 'anthropic/claude-3-5-sonnet-20241022',
            tools: ['read_file', 'run_terminal_cmd'],
            prompt: 'You are a senior developer reviewing code for quality, security, and best practices.'
        },
        {
            name: 'BugFixer',
            description: 'Agent for debugging and fixing issues',
            model: 'gemini/gemini-1.5-flash',
            tools: ['read_file', 'grep', 'run_terminal_cmd'],
            prompt: 'You are an expert debugger. Analyze code, find bugs, and provide fixes with explanations.'
        },
        {
            name: 'DocumentationWriter',
            description: 'Agent for writing and updating documentation',
            model: 'openai/gpt-4o-mini',
            tools: ['read_file', 'search_replace'],
            prompt: 'You are a technical writer. Create clear, comprehensive documentation for code and APIs.'
        }
    ];

    // Add agents if they don't exist
    for (const agent of teamAgents) {
        const existingAgentIndex = config.agents!.findIndex((a: AgentConfig) => a.name === agent.name);
        if (existingAgentIndex === -1) {
            config.agents!.push(agent);
        } else {
            config.agents![existingAgentIndex] = agent;
        }
    }

    return config;
}

function applyRulesAndPrompts(config: ContinueConfig): ContinueConfig {
    console.log('[Skoop Continue Sync] Applying rules and prompts...');
    console.log('[Skoop Continue Sync] Existing rules count:', config.rules!.length);

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
        const existingRuleIndex = config.rules!.findIndex((r: RuleConfig) => r.name === rule.name);
        if (existingRuleIndex === -1) {
            config.rules!.push(rule);
        } else {
            config.rules![existingRuleIndex] = rule;
        }
    }

    // Apply global prompts (already initialized as empty array)

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
        const existingPromptIndex = config.prompts!.findIndex((p: PromptConfig) => p.name === prompt.name);
        if (existingPromptIndex === -1) {
            config.prompts!.push(prompt);
        } else {
            config.prompts![existingPromptIndex] = prompt;
        }
    }

    return config;
}

export function deactivate() {}

// Simple YAML serializer for basic structures
function configToYaml(config: ContinueConfig): string {
    let yaml = '';

    // Add basic fields
    if (config.name) yaml += `name: "${config.name}"\n`;
    if (config.version) yaml += `version: "${config.version}"\n`;
    if (config.schema) yaml += `schema: "${config.schema}"\n`;

    // Add models
    if (config.models && config.models.length > 0) {
        yaml += '\nmodels:\n';
        for (const model of config.models) {
            yaml += '  - provider: ' + model.provider + '\n';
            yaml += '    model: ' + model.model + '\n';
            if (model.apiBase) yaml += '    apiBase: ' + model.apiBase + '\n';
            if (model.apiKey) yaml += '    apiKey: ' + model.apiKey + '\n';
            if (model.title) yaml += '    title: "' + model.title + '"\n';
            if (model.roles && model.roles.length > 0) {
                yaml += '    roles:\n';
                for (const role of model.roles) {
                    yaml += '      - ' + role + '\n';
                }
            }
            if (model.isDefault) yaml += '    isDefault: true\n';
        }
    }

    // Add agents
    if (config.agents && config.agents.length > 0) {
        yaml += '\nagents:\n';
        for (const agent of config.agents) {
            yaml += '  - name: "' + agent.name + '"\n';
            if (agent.description) yaml += '    description: "' + agent.description + '"\n';
            yaml += '    model: ' + agent.model + '\n';
            if (agent.tools && agent.tools.length > 0) {
                yaml += '    tools:\n';
                for (const tool of agent.tools) {
                    yaml += '      - ' + tool + '\n';
                }
            }
            if (agent.prompt) yaml += '    prompt: "' + agent.prompt.replace(/"/g, '\\"') + '"\n';
        }
    }

    // Add rules
    if (config.rules && config.rules.length > 0) {
        yaml += '\nrules:\n';
        for (const rule of config.rules) {
            yaml += '  - name: "' + rule.name + '"\n';
            if (rule.description) yaml += '    description: "' + rule.description + '"\n';
            yaml += '    rule: "' + rule.rule.replace(/"/g, '\\"') + '"\n';
        }
    }

    // Add prompts
    if (config.prompts && config.prompts.length > 0) {
        yaml += '\nprompts:\n';
        for (const prompt of config.prompts) {
            yaml += '  - name: "' + prompt.name + '"\n';
            if (prompt.description) yaml += '    description: "' + prompt.description + '"\n';
            yaml += '    prompt: "' + prompt.prompt.replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"\n';
        }
    }

    return yaml;
}
