"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function activate(context) {
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
        }
        catch (error) {
            console.error('[Skoop Continue Sync] Error applying team settings:', error);
            vscode.window.showErrorMessage(`Failed to apply team settings: ${error}`);
        }
    });
    context.subscriptions.push(disposable);
    console.log('[Skoop Continue Sync] Command registered: skoop-continue-sync.applyTeamSettings');
}
exports.activate = activate;
async function applyTeamSettings() {
    console.log('[Skoop Continue Sync] Finding Continue config path...');
    const configPath = await findContinueConfigPath();
    if (!configPath) {
        console.error('[Skoop Continue Sync] Could not find Continue.dev config file');
        throw new Error('Could not find Continue.dev config file. Please make sure Continue is installed and configured.');
    }
    console.log('[Skoop Continue Sync] Found config path:', configPath);
    let config = {};
    // Read existing config if it exists
    if (fs.existsSync(configPath)) {
        console.log('[Skoop Continue Sync] Reading existing config from:', configPath);
        try {
            const configContent = fs.readFileSync(configPath, 'utf8');
            console.log('[Skoop Continue Sync] Config content length:', configContent.length);
            // Try JSON first, then fall back to simple YAML parsing
            try {
                config = JSON.parse(configContent);
                console.log('[Skoop Continue Sync] Parsed config as JSON');
            }
            catch (jsonError) {
                console.log('[Skoop Continue Sync] JSON parsing failed, trying simple YAML parsing');
                config = parseSimpleYaml(configContent);
            }
            console.log('[Skoop Continue Sync] Parsed config:', JSON.stringify(config, null, 2));
        }
        catch (error) {
            console.error('[Skoop Continue Sync] Error reading/parsing config:', error);
            throw error;
        }
    }
    else {
        console.log('[Skoop Continue Sync] No existing config found, creating new one');
    }
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
        const yamlContent = JSON.stringify(config, null, 2);
        console.log('[Skoop Continue Sync] Generated YAML content length:', yamlContent.length);
        console.log('[Skoop Continue Sync] Final config to write:', yamlContent);
        fs.writeFileSync(configPath, yamlContent, 'utf8');
        console.log('[Skoop Continue Sync] Config written successfully to:', configPath);
    }
    catch (error) {
        console.error('[Skoop Continue Sync] Error writing config:', error);
        throw error;
    }
}
async function findContinueConfigPath() {
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
            }
            catch (error) {
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
function applyLiteLLMSettings(config) {
    console.log('[Skoop Continue Sync] Reading VS Code configuration...');
    const litellmUrl = vscode.workspace.getConfiguration('skoop-continue-sync').get('litellmUrl', 'https://litellm.skoop.digital/');
    const litellmApiKey = vscode.workspace.getConfiguration('skoop-continue-sync').get('litellmApiKey', 'sk-Phkcy9C76yAAc2rNAAsnlg');
    console.log('[Skoop Continue Sync] LiteLLM URL:', litellmUrl);
    console.log('[Skoop Continue Sync] LiteLLM API Key length:', litellmApiKey.length);
    // Initialize models array if it doesn't exist
    if (!config.models) {
        console.log('[Skoop Continue Sync] Initializing models array');
        config.models = [];
    }
    else {
        console.log('[Skoop Continue Sync] Existing models count:', config.models.length);
    }
    // Add LiteLLM provider if not already present
    const existingProviderIndex = config.models.findIndex((m) => m.provider === 'openai' && m.apiBase?.includes('litellm.skoop.digital'));
    console.log('[Skoop Continue Sync] Existing LiteLLM provider index:', existingProviderIndex);
    const litellmProvider = {
        provider: 'openai',
        model: 'gpt-4',
        apiBase: litellmUrl,
        apiKey: litellmApiKey,
        title: 'LiteLLM Server'
    };
    if (existingProviderIndex === -1) {
        console.log('[Skoop Continue Sync] Adding new LiteLLM provider');
        config.models.push(litellmProvider);
    }
    else {
        console.log('[Skoop Continue Sync] Updating existing LiteLLM provider');
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
    console.log('[Skoop Continue Sync] Adding team models...');
    // Add team models if they don't exist
    for (const teamModel of teamModels) {
        const existingModelIndex = config.models.findIndex((m) => m.model === teamModel.model && m.apiBase === teamModel.apiBase);
        console.log(`[Skoop Continue Sync]   ${teamModel.title}: ${existingModelIndex === -1 ? 'Adding' : 'Already exists'}`);
        if (existingModelIndex === -1) {
            config.models.push(teamModel);
        }
    }
    console.log('[Skoop Continue Sync] Final models count:', config.models.length);
    return config;
}
function applyModelSettings(config) {
    console.log('[Skoop Continue Sync] Setting default models...');
    // Set default models for different roles
    config.models = config.models || [];
    console.log('[Skoop Continue Sync] Models before setting defaults:', config.models.length);
    // Set primary chat model
    const chatModelIndex = config.models.findIndex((m) => m.model === 'openai/gpt-5-mini' && m.roles?.includes('chat'));
    console.log('[Skoop Continue Sync] Chat model index:', chatModelIndex);
    if (chatModelIndex !== -1) {
        config.models[chatModelIndex].isDefault = true;
        console.log('[Skoop Continue Sync] Set GPT-5 Mini as default chat model');
    }
    return config;
}
function applyAgentSettings(config) {
    console.log('[Skoop Continue Sync] Applying agent settings...');
    // Define team agents
    config.agents = config.agents || [];
    console.log('[Skoop Continue Sync] Existing agents count:', config.agents.length);
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
        const existingAgentIndex = config.agents.findIndex((a) => a.name === agent.name);
        if (existingAgentIndex === -1) {
            config.agents.push(agent);
        }
        else {
            config.agents[existingAgentIndex] = agent;
        }
    }
    return config;
}
function applyRulesAndPrompts(config) {
    console.log('[Skoop Continue Sync] Applying rules and prompts...');
    // Apply global rules
    config.rules = config.rules || [];
    console.log('[Skoop Continue Sync] Existing rules count:', config.rules.length);
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
        const existingRuleIndex = config.rules.findIndex((r) => r.name === rule.name);
        if (existingRuleIndex === -1) {
            config.rules.push(rule);
        }
        else {
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
        const existingPromptIndex = config.prompts.findIndex((p) => p.name === prompt.name);
        if (existingPromptIndex === -1) {
            config.prompts.push(prompt);
        }
        else {
            config.prompts[existingPromptIndex] = prompt;
        }
    }
    return config;
}
function deactivate() { }
exports.deactivate = deactivate;
// Simple YAML parser for basic YAML structures
function parseSimpleYaml(yamlContent) {
    const lines = yamlContent.split('\n');
    const result = {};
    let currentSection = result;
    let indentLevel = 0;
    let sectionStack = [result];
    for (const line of lines) {
        const trimmed = line.trim();
        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith('#')) {
            continue;
        }
        // Calculate indentation
        const currentIndent = line.length - line.trimStart().length;
        // Handle section headers (like models:, agents:, etc.)
        if (trimmed.endsWith(':') && !trimmed.includes(' ')) {
            const sectionName = trimmed.slice(0, -1);
            currentSection[sectionName] = currentSection[sectionName] || [];
            sectionStack = [result];
            currentSection = result[sectionName];
            indentLevel = currentIndent;
            continue;
        }
        // Handle key-value pairs
        if (trimmed.includes(':')) {
            const [key, ...valueParts] = trimmed.split(':');
            const value = valueParts.join(':').trim();
            if (value.startsWith('"') && value.endsWith('"')) {
                currentSection[key.trim()] = value.slice(1, -1);
            }
            else if (value.startsWith("'") && value.endsWith("'")) {
                currentSection[key.trim()] = value.slice(1, -1);
            }
            else if (value === 'true') {
                currentSection[key.trim()] = true;
            }
            else if (value === 'false') {
                currentSection[key.trim()] = false;
            }
            else if (!isNaN(Number(value))) {
                currentSection[key.trim()] = Number(value);
            }
            else if (value) {
                currentSection[key.trim()] = value;
            }
            else {
                // This might be a nested object
                currentSection[key.trim()] = {};
                currentSection = currentSection[key.trim()];
            }
        }
    }
    return result;
}
//# sourceMappingURL=extension.js.map