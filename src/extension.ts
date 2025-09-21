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

    // Check for required extensions
    const requiredExtensions = [
        { id: 'Continue.continue', name: 'Continue', marketplaceUrl: 'https://marketplace.visualstudio.com/items?itemName=Continue.continue' },
        { id: 'SpecStory.specstory-vscode', name: 'SpecStory', marketplaceUrl: 'https://marketplace.visualstudio.com/items?itemName=SpecStory.specstory-vscode' }
    ];

    const missingExtensions = requiredExtensions.filter(ext => !vscode.extensions.getExtension(ext.id));

    if (missingExtensions.length > 0) {
        const extensionNames = missingExtensions.map(ext => ext.name).join(', ');
        const message = `Skoop Continue Sync requires the following extensions to be installed: ${extensionNames}. Please install them from the VS Code marketplace.`;

        console.error('[Skoop Continue Sync] Missing required extensions:', extensionNames);
        vscode.window.showErrorMessage(message, 'Install Extensions').then(selection => {
            if (selection === 'Install Extensions') {
                // Open each missing extension in the marketplace
                missingExtensions.forEach(ext => {
                    vscode.env.openExternal(vscode.Uri.parse(ext.marketplaceUrl));
                });
            }
        });

        // Still register commands but they will show appropriate error messages
    }

    const applySettingsDisposable = vscode.commands.registerCommand('skoop-continue-sync.applyTeamSettings', async () => {
        console.log('[Skoop Continue Sync] Apply team settings command triggered');

        // Check for required extensions before proceeding
        const requiredExtensions = ['Continue.continue', 'SpecStory.specstory-vscode'];
        const missingExtensions = requiredExtensions.filter(extId => !vscode.extensions.getExtension(extId));

        if (missingExtensions.length > 0) {
            const extensionNames = missingExtensions.map(id => id === 'Continue.continue' ? 'Continue' : 'SpecStory').join(', ');
            const message = `Cannot apply team settings. Required extensions are not installed: ${extensionNames}. Please install them first.`;
            console.error('[Skoop Continue Sync] Missing required extensions for command execution:', extensionNames);
            vscode.window.showErrorMessage(message);
            return;
        }

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

    const clearConfigDisposable = vscode.commands.registerCommand('skoop-continue-sync.clearAllConfigs', async () => {
        console.log('[Skoop Continue Sync] Clear all configs command triggered');

        // Check for required extensions before proceeding
        const requiredExtensions = ['Continue.continue', 'SpecStory.specstory-vscode'];
        const missingExtensions = requiredExtensions.filter(extId => !vscode.extensions.getExtension(extId));

        if (missingExtensions.length > 0) {
            const extensionNames = missingExtensions.map(id => id === 'Continue.continue' ? 'Continue' : 'SpecStory').join(', ');
            const message = `Cannot clear configurations. Required extensions are not installed: ${extensionNames}. Please install them first.`;
            console.error('[Skoop Continue Sync] Missing required extensions for command execution:', extensionNames);
            vscode.window.showErrorMessage(message);
            return;
        }

        try {
            await clearAllContinueConfigs();
            console.log('[Skoop Continue Sync] All Continue configs cleared successfully');
            vscode.window.showInformationMessage('All Continue configurations cleared successfully!');
        } catch (error) {
            console.error('[Skoop Continue Sync] Error clearing configs:', error);
            vscode.window.showErrorMessage(`Failed to clear configurations: ${error}`);
        }
    });

    context.subscriptions.push(applySettingsDisposable, clearConfigDisposable);
    console.log('[Skoop Continue Sync] Commands registered: skoop-continue-sync.applyTeamSettings, skoop-continue-sync.clearAllConfigs');
}

interface ModelConfig {
    provider?: string;
    model?: string;
    apiBase?: string;
    apiKey?: string;
    name?: string;
    title?: string;
    roles?: string[];
    uses?: string;
    with?: { [key: string]: string };
    override?: { roles?: string[] };
    defaultCompletionOptions?: {
        contextLength?: number;
        maxTokens?: number;
        temperature?: number;
        topP?: number;
        stop?: string[];
        [key: string]: any;
    };
    chatOptions?: {
        baseSystemMessage?: string;
        baseAgentSystemMessage?: string;
        [key: string]: any;
    };
    autocompleteOptions?: {
        disable?: boolean;
        maxPromptTokens?: number;
        debounceDelay?: number;
        maxSuffixPercentage?: number;
        prefixPercentage?: number;
        onlyMyCode?: boolean;
        useCache?: boolean;
        useImports?: boolean;
        useRecentlyEdited?: boolean;
        useRecentlyOpened?: boolean;
        [key: string]: any;
    };
    embedOptions?: {
        maxChunkSize?: number;
        maxBatchSize?: number;
        [key: string]: any;
    };
    [key: string]: any;
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
    name?: string;
    description?: string;
    rule?: string;
    uses?: string;
    [key: string]: string | undefined;
}

interface PromptConfig {
    name?: string;
    description?: string;
    prompt?: string;
    uses?: string;
    [key: string]: string | undefined;
}

interface DocConfig {
    name: string;
    startUrl: string;
    favicon?: string;
    [key: string]: string | undefined;
}

interface ContinueConfig {
    name?: string;
    version?: string;
    schema?: string;
    experimental?: {
        useChromiumForDocsCrawling?: boolean;
    };
    models?: ModelConfig[];
    agents?: AgentConfig[];
    rules?: RuleConfig[];
    prompts?: PromptConfig[];
    docs?: DocConfig[];
    [key: string]: any;
}

async function applyTeamSettings() {
    console.log('[Skoop Continue Sync] Finding Continue config path...');
    const configPath = await findContinueConfigPath();
    if (!configPath) {
        console.error('[Skoop Continue Sync] Could not find Continue.dev config file');
        throw new Error('Could not find Continue.dev config file. Please make sure Continue is installed and configured.');
    }
    console.log('[Skoop Continue Sync] Found config path:', configPath);

    // Load team configuration from external file
    console.log('[Skoop Continue Sync] Loading team configuration...');
    const teamConfigPath = path.join(__dirname, '..', 'team-config.json');
    console.log('[Skoop Continue Sync] Looking for config at:', teamConfigPath);
    let teamConfig;
    try {
        const teamConfigContent = fs.readFileSync(teamConfigPath, 'utf8');
        teamConfig = JSON.parse(teamConfigContent);
        console.log('[Skoop Continue Sync] Team configuration loaded successfully');
    } catch (error) {
        console.error('[Skoop Continue Sync] Failed to load team configuration:', error);
        console.error('[Skoop Continue Sync] __dirname:', __dirname);
        console.error('[Skoop Continue Sync] Attempted path:', teamConfigPath);
        throw new Error('Could not load team configuration file. Please ensure the extension is properly installed.');
    }

    // Load the Local Agent configuration from the extension's agents folder
    console.log('[Skoop Continue Sync] Loading Local Agent configuration...');
    const localAgentPath = path.join(__dirname, '..', 'agents', 'local-agent.yaml');
    let localAgentContent;
    try {
        localAgentContent = fs.readFileSync(localAgentPath, 'utf8');
        console.log('[Skoop Continue Sync] Local Agent configuration loaded successfully');
    } catch (error) {
        console.error('[Skoop Continue Sync] Failed to load Local Agent configuration:', error);
        throw new Error('Could not load Local Agent configuration. Please ensure the extension is properly installed.');
    }

    // Clear any existing config to avoid parsing issues
    console.log('[Skoop Continue Sync] Clearing existing config file...');
    try {
        if (fs.existsSync(configPath)) {
            fs.unlinkSync(configPath);
            console.log('[Skoop Continue Sync] Existing config cleared');
        }
    } catch (error) {
        console.warn('[Skoop Continue Sync] Could not clear existing config:', error);
    }

    // Use the Local Agent content as the main config
    console.log('[Skoop Continue Sync] Using Local Agent as main configuration');

    // Ensure Chromium is available for docs crawling
    console.log('[Skoop Continue Sync] Checking Chromium availability...');
    await ensureChromiumAvailable();

    // Configure VS Code Continue.dev extension settings
    console.log('[Skoop Continue Sync] Configuring Continue.dev extension settings...');
    await configureContinueSettings(teamConfig);

    console.log('[Skoop Continue Sync] Installing agent files...');
    await installAgentFiles(configPath);

    // Force retry docs indexing to clear any previous failures
    console.log('[Skoop Continue Sync] Processing Local Agent config for docs retry...');
    // Parse the YAML to get the docs section for retry logic
    const localAgentConfig = parseYamlToConfig(localAgentContent);
    forceDocsRetry(localAgentConfig);

    // Write the Local Agent config as the main config
    console.log('[Skoop Continue Sync] Writing Local Agent config...');
    try {
        console.log('[Skoop Continue Sync] Final config to write:', localAgentContent);
        fs.writeFileSync(configPath, localAgentContent, 'utf8');
        console.log('[Skoop Continue Sync] Local Agent config written successfully to:', configPath);
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

// Ensure Chromium is available for docs crawling
async function ensureChromiumAvailable() {
    console.log('[Skoop Continue Sync] Ensuring Chromium is available for docs crawling...');

    const os = require('os');
    const path = require('path');
    const fs = require('fs');

    // Check common Chromium installation locations
    const possiblePaths = [
        'chromium', // In PATH
        'chromium-browser', // Linux variant
        'google-chrome', // Chrome as fallback
        'chrome', // Chrome in PATH
        path.join(os.homedir(), '.continue', '.utils', 'chromium', 'chrome'), // Continue.dev location
        path.join(os.homedir(), '.continue', '.utils', 'chromium', 'chromium'), // Continue.dev location
        '/usr/bin/chromium', // Linux system location
        '/usr/bin/chromium-browser', // Linux system location
        'C:\\Program Files\\Chromium\\Application\\chrome.exe', // Windows
        'C:\\Program Files (x86)\\Chromium\\Application\\chrome.exe', // Windows x86
    ];

    for (const chromiumPath of possiblePaths) {
        try {
            console.log(`[Skoop Continue Sync] Checking Chromium at: ${chromiumPath}`);
            const { spawn } = require('child_process');
            const chromiumCheck = spawn(chromiumPath, ['--version'], { stdio: 'pipe' });

            const result = await new Promise<boolean>((resolve) => {
                chromiumCheck.on('close', (code: number) => {
                    resolve(code === 0);
                });
                chromiumCheck.on('error', () => resolve(false));

                // Timeout after 2 seconds
                setTimeout(() => resolve(false), 2000);
            });

            if (result) {
                console.log(`[Skoop Continue Sync] Chromium found at: ${chromiumPath}`);
                return true;
            }
        } catch (error) {
            // Continue to next path
        }
    }

    console.log('[Skoop Continue Sync] Chromium not found in common locations, will be downloaded by Continue.dev');
    console.log('[Skoop Continue Sync] Continue.dev typically installs Chromium to: ~/.continue/.utils/chromium/');
    return false;
}

// Configure VS Code Continue.dev extension settings
async function configureContinueSettings(teamConfig: any) {
    console.log('[Skoop Continue Sync] Configuring VS Code Continue.dev extension settings...');

    try {
        const vscodeSettings = teamConfig.vscodeSettings || {};

        for (const [settingKey, desiredValue] of Object.entries(vscodeSettings)) {
            // Parse the setting key (e.g., "continue.enableConsole" -> ["continue", "enableConsole"])
            const [extensionId, settingName] = settingKey.split('.', 2);

            if (extensionId && settingName) {
                const config = vscode.workspace.getConfiguration(extensionId);
                const currentValue = config.get(settingName);

                console.log(`[Skoop Continue Sync] Checking ${settingKey}: current=${currentValue}, desired=${desiredValue}`);

                if (currentValue !== desiredValue) {
                    await config.update(settingName, desiredValue, vscode.ConfigurationTarget.Global);
                    console.log(`[Skoop Continue Sync] Set ${settingKey} to ${desiredValue}`);
                } else {
                    console.log(`[Skoop Continue Sync] ${settingKey} already set to ${desiredValue}`);
                }
            }
        }

        console.log('[Skoop Continue Sync] Continue.dev extension settings configured successfully');
    } catch (error) {
        console.warn('[Skoop Continue Sync] Error configuring Continue.dev settings:', error);
    }
}

// Force retry docs indexing by updating timestamp
function forceDocsRetry(config: ContinueConfig) {
    console.log('[Skoop Continue Sync] Forcing docs retry by updating configuration...');

    // Add a timestamp to force re-indexing
    if (config.docs && Array.isArray(config.docs) && config.docs.length > 0) {
        config.docs.forEach((doc: DocConfig) => {
            if (doc.startUrl) {
                // Add a cache-busting parameter
                const separator = doc.startUrl.includes('?') ? '&' : '?';
                doc.startUrl = `${doc.startUrl}${separator}retry=${Date.now()}`;
                console.log(`[Skoop Continue Sync] Updated docs URL to force retry: ${doc.startUrl}`);
            }
        });
    }
}

function applyLiteLLMSettings(config: ContinueConfig, teamConfig: any): ContinueConfig {
    console.log('[Skoop Continue Sync] Reading VS Code configuration...');
    const litellmUrl = vscode.workspace.getConfiguration('skoop-continue-sync').get('litellmUrl', teamConfig.liteLLM?.url || 'https://litellm.skoop.digital/');
    const litellmApiKey = vscode.workspace.getConfiguration('skoop-continue-sync').get('litellmApiKey', teamConfig.liteLLM?.apiKey || 'sk-Phkcy9C76yAAc2rNAAsnlg');

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
        model: 'gpt-4',
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

    // Add specific models from team config
    const teamModels = teamConfig.models?.map((modelConfig: any) => ({
        provider: modelConfig.provider,
        model: modelConfig.model,
        apiBase: litellmUrl,
        apiKey: litellmApiKey,
        name: modelConfig.name,
        roles: modelConfig.roles
    })) || [];

    console.log('[Skoop Continue Sync] Adding team models...');
    // Clear existing models and add fresh ones to avoid conflicts
    console.log('[Skoop Continue Sync] Clearing existing models to avoid conflicts...');
    config.models!.length = 0; // Clear the array

    // Add all team models fresh
    for (const teamModel of teamModels) {
        console.log(`[Skoop Continue Sync]   Adding: ${teamModel.name}`);
        config.models!.push(teamModel);
    }

    console.log('[Skoop Continue Sync] Final models count:', config.models!.length);
    return config;
}

function applyModelSettings(config: ContinueConfig): ContinueConfig {
    console.log('[Skoop Continue Sync] Setting default models...');
    console.log('[Skoop Continue Sync] Models before setting defaults:', config.models!.length);

    return config;
}


function applyRulesAndPrompts(config: ContinueConfig, teamConfig: any): ContinueConfig {
    console.log('[Skoop Continue Sync] Applying rules and prompts...');
    console.log('[Skoop Continue Sync] Existing rules count:', config.rules!.length);

    const teamRules = teamConfig.rules || [];

    // Add rules if they don't exist
    for (const rule of teamRules) {
        // Handle hub blocks (uses syntax)
        if (rule.uses) {
            const existingRuleIndex = config.rules!.findIndex((r: any) => r.uses === rule.uses);
            if (existingRuleIndex === -1) {
                config.rules!.push(rule);
            } else {
                config.rules![existingRuleIndex] = rule;
            }
        } else {
            // Handle local blocks
            const existingRuleIndex = config.rules!.findIndex((r: RuleConfig) => r.name === rule.name);
            if (existingRuleIndex === -1) {
                config.rules!.push(rule);
            } else {
                config.rules![existingRuleIndex] = rule;
            }
        }
    }

    // Apply global prompts (already initialized as empty array)

    const teamPrompts = teamConfig.prompts || [];

    // Add prompts if they don't exist
    for (const prompt of teamPrompts) {
        // Handle hub blocks (uses syntax)
        if (prompt.uses) {
            const existingPromptIndex = config.prompts!.findIndex((p: any) => p.uses === prompt.uses);
            if (existingPromptIndex === -1) {
                config.prompts!.push(prompt);
            } else {
                config.prompts![existingPromptIndex] = prompt;
            }
        } else {
            // Handle local blocks
            const existingPromptIndex = config.prompts!.findIndex((p: PromptConfig) => p.name === prompt.name);
            if (existingPromptIndex === -1) {
                config.prompts!.push(prompt);
            } else {
                config.prompts![existingPromptIndex] = prompt;
            }
        }
    }

    return config;
}

// Clear all Continue.dev configurations
async function clearAllContinueConfigs() {
    console.log('[Skoop Continue Sync] Starting to clear all Continue configurations...');

    // Clear main config file (write empty content instead of deleting)
    const configPath = await findContinueConfigPath();
    if (configPath && fs.existsSync(configPath)) {
        // Write empty but valid YAML instead of deleting
        const emptyConfig = `name: "Empty Config"\nversion: "1.0.0"\nschema: "v1"\n\nmodels: []\nrules: []\nprompts: []\ndocs: []\n`;
        fs.writeFileSync(configPath, emptyConfig, 'utf8');
        console.log('[Skoop Continue Sync] Cleared main config file content');

        // Also create empty config.json if it exists
        const jsonConfigPath = configPath.replace('.yaml', '.json');
        if (fs.existsSync(jsonConfigPath)) {
            fs.writeFileSync(jsonConfigPath, '{}', 'utf8');
            console.log('[Skoop Continue Sync] Cleared config.json content');
        }
    }

    // Clear all subdirectories
    const continueDir = path.dirname(configPath || path.join(process.env.USERPROFILE || '', '.continue', 'config.yaml'));

    const subDirs = ['agents', 'models', 'rules', 'prompts', 'docs', 'mcpServers'];
    for (const subDir of subDirs) {
        const dirPath = path.join(continueDir, subDir);
        if (fs.existsSync(dirPath)) {
            // Remove all files in the directory
            const files = fs.readdirSync(dirPath);
            for (const file of files) {
                const filePath = path.join(dirPath, file);
                if (fs.statSync(filePath).isFile()) {
                    fs.unlinkSync(filePath);
                    console.log(`[Skoop Continue Sync] Removed ${subDir}/${file}`);
                }
            }
        }
    }

    console.log('[Skoop Continue Sync] All Continue configurations cleared');
}

export function deactivate() {}

// Simple YAML serializer for basic structures with hub support
function configToYaml(config: ContinueConfig): string {
    let yaml = '';

    // Add basic fields
    if (config.name) yaml += `name: "${config.name}"\n`;
    if (config.version) yaml += `version: "${config.version}"\n`;
    if (config.schema) yaml += `schema: "${config.schema}"\n`;

    // Add models - support both hub and local formats
    if (config.models && config.models.length > 0) {
        yaml += '\nmodels:\n';
        for (const model of config.models) {
            if ((model as any).uses) {
                // Hub reference format
                yaml += `  - uses: ${(model as any).uses}\n`;
                if ((model as any).with) {
                    yaml += '    with:\n';
                    for (const [key, value] of Object.entries((model as any).with)) {
                        yaml += `      ${key}: "${value}"\n`;
                    }
                }
                if ((model as any).override) {
                    yaml += '    override:\n';
                    if ((model as any).override.roles) {
                        yaml += '      roles:\n';
                        for (const role of (model as any).override.roles) {
                            yaml += `        - ${role}\n`;
                        }
                    }
                }
            } else {
                // Local model format
                yaml += '  - name: "' + (model.title || model.name || model.model) + '"\n';
                yaml += '    provider: ' + model.provider + '\n';
                yaml += '    model: ' + model.model + '\n';
                if (model.apiKey) yaml += '    apiKey: "' + model.apiKey + '"\n';
                if (model.apiBase) yaml += '    apiBase: ' + model.apiBase + '\n';
                if (model.roles && model.roles.length > 0) {
                    yaml += '    roles:\n';
                    for (const role of model.roles) {
                        yaml += '      - ' + role + '\n';
                    }
                }
                if ((model as any).defaultCompletionOptions) {
                    yaml += '    defaultCompletionOptions:\n';
                    const opts = (model as any).defaultCompletionOptions;
                    if (opts.contextLength) yaml += `      contextLength: ${opts.contextLength}\n`;
                    if (opts.maxTokens) yaml += `      maxTokens: ${opts.maxTokens}\n`;
                }
            }
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

    // Add rules - support both hub and local formats
    if (config.rules && config.rules.length > 0) {
        yaml += '\nrules:\n';
        for (const rule of config.rules) {
            if ((rule as any).uses) {
                // Hub reference format
                yaml += `  - uses: ${(rule as any).uses}\n`;
            } else {
                // Local rule format
                if (rule.name) yaml += '  - name: "' + rule.name + '"\n';
                if (rule.description) yaml += '    description: "' + rule.description + '"\n';
                if (rule.rule) yaml += '    rule: "' + rule.rule.replace(/"/g, '\\"') + '"\n';
            }
        }
    }

    // Add prompts - support both hub and local formats
    if (config.prompts && config.prompts.length > 0) {
        yaml += '\nprompts:\n';
        for (const prompt of config.prompts) {
            if ((prompt as any).uses) {
                // Hub reference format
                yaml += `  - uses: ${(prompt as any).uses}\n`;
            } else {
                // Local prompt format
                if (prompt.name) yaml += '  - name: "' + prompt.name + '"\n';
                if (prompt.description) yaml += '    description: "' + prompt.description + '"\n';
                if (prompt.prompt) yaml += '    prompt: "' + prompt.prompt.replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"\n';
            }
        }
    }

    // Add docs
    if (config.docs && config.docs.length > 0) {
        yaml += '\ndocs:\n';
        for (const doc of config.docs) {
            yaml += '  - name: "' + doc.name + '"\n';
            yaml += '    startUrl: ' + doc.startUrl + '\n';
            if (doc.favicon) yaml += '    favicon: ' + doc.favicon + '\n';
        }
    }

    return yaml;
}


// Install agent files from extension's agents folder to .continue/agents/
async function installAgentFiles(configPath: string) {
    console.log('[Skoop Continue Sync] Installing agent files...');

    const configDir = path.dirname(configPath);
    const targetAgentsDir = path.join(configDir, 'agents');
    const sourceAgentsDir = path.join(__dirname, '..', 'agents');

    // Ensure target agents directory exists
    if (!fs.existsSync(targetAgentsDir)) {
        fs.mkdirSync(targetAgentsDir, { recursive: true });
        console.log('[Skoop Continue Sync] Created agents directory:', targetAgentsDir);
    }

    // Clean up any existing agent files
    console.log('[Skoop Continue Sync] Cleaning up existing agent files...');
    const existingFiles = fs.readdirSync(targetAgentsDir).filter(file => file.endsWith('.yaml'));
    for (const file of existingFiles) {
        const filePath = path.join(targetAgentsDir, file);
        try {
            fs.unlinkSync(filePath);
            console.log(`[Skoop Continue Sync] Removed existing agent file: ${file}`);
        } catch (error) {
            console.warn(`[Skoop Continue Sync] Could not remove agent file ${file}:`, error);
        }
    }

    // Copy agent files from extension's agents folder (excluding local-agent.yaml)
    if (fs.existsSync(sourceAgentsDir)) {
        const agentFiles = fs.readdirSync(sourceAgentsDir).filter(file =>
            file.endsWith('.yaml') && file !== 'local-agent.yaml'
        );

        for (const file of agentFiles) {
            const sourcePath = path.join(sourceAgentsDir, file);
            const targetPath = path.join(targetAgentsDir, file);

            try {
                const content = fs.readFileSync(sourcePath, 'utf8');
                fs.writeFileSync(targetPath, content, 'utf8');
                console.log(`[Skoop Continue Sync] Installed agent file: ${file}`);
            } catch (error) {
                console.warn(`[Skoop Continue Sync] Could not copy agent file ${file}:`, error);
            }
        }

        console.log(`[Skoop Continue Sync] Installed ${agentFiles.length} agent files in ${targetAgentsDir}`);
    } else {
        console.warn('[Skoop Continue Sync] Source agents directory not found:', sourceAgentsDir);
    }
}

// Simple YAML parser to extract docs section for retry logic
function parseYamlToConfig(yamlContent: string): ContinueConfig {
    const config: ContinueConfig = {
        docs: []
    };

    // Simple parsing to extract docs section
    const lines = yamlContent.split('\n');
    let inDocsSection = false;

    for (const line of lines) {
        if (line.trim() === 'docs:') {
            inDocsSection = true;
            continue;
        }

        if (inDocsSection) {
            if (line.startsWith('  - name:')) {
                // Extract doc name
                const nameMatch = line.match(/name:\s*"([^"]+)"/);
                if (nameMatch) {
                    config.docs!.push({
                        name: nameMatch[1],
                        startUrl: '',
                        favicon: ''
                    });
                }
            } else if (line.startsWith('    startUrl:')) {
                // Extract startUrl
                const urlMatch = line.match(/startUrl:\s*(.+)/);
                if (urlMatch && config.docs!.length > 0) {
                    config.docs![config.docs!.length - 1].startUrl = urlMatch[1];
                }
            } else if (line.startsWith('    favicon:')) {
                // Extract favicon
                const faviconMatch = line.match(/favicon:\s*(.+)/);
                if (faviconMatch && config.docs!.length > 0) {
                    config.docs![config.docs!.length - 1].favicon = faviconMatch[1];
                }
            }
        }
    }

    return config;
}