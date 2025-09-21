import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

// Global state for automatic refresh
let lastConfigRefresh = 0;
let refreshTimer: NodeJS.Timeout | null = null;
let isOnline = true;

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

    // Setup automatic config refresh
    setupAutomaticRefresh(context);

    // Setup configuration change listeners for manual triggers
    setupConfigurationListeners(context);

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

interface SettingsConfig {
    [key: string]: any;
}

interface AgentDefinition {
    agent: string;
    name: string;
    version: string;
    schema: string;
    description: string;
    models?: ModelConfig[];
    rules?: RuleConfig[];
    prompts?: PromptConfig[];
    context?: any[];
    docs?: DocConfig[];
    mcpServers?: any[];
    [key: string]: any;
}

interface TeamConfig {
    settings?: SettingsConfig[];
    Agents?: AgentDefinition[];
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

// Fetch configuration from HTTP endpoint
async function fetchTeamConfig(): Promise<TeamConfig & { rawYaml: string }> {
    console.log('[Skoop Continue Sync] Fetching team configuration from endpoint...');

    const userEmail = vscode.workspace.getConfiguration('skoop-continue-sync').get('userEmail', '');
    const userPassword = vscode.workspace.getConfiguration('skoop-continue-sync').get('userPassword', '');

    if (!userEmail || !userPassword) {
        throw new Error('User email and password must be configured in Skoop Continue Sync settings.');
    }

    const endpoint = 'https://n8n.skoopsignage.dev/webhook/4cf533b9-7da1-483d-b6a0-98155fe715ca';

    return new Promise((resolve, reject) => {
        const url = new URL(endpoint);
        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: 'GET',
            headers: {
                'Authorization': 'V2e&ytoH@*30%*yWQ%3lS0ck@w@viy6E',
                'user': userEmail,
                'password': userPassword,
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    console.log('[Skoop Continue Sync] Received response from endpoint');
                    console.log('[Skoop Continue Sync] Raw response data (first 200 chars):', data.substring(0, 200));

                    let configData: string;

                    // Try to parse as JSON first (expected format)
                    try {
                        const response = JSON.parse(data);
                        if (Array.isArray(response) && response.length > 0 && response[0].data) {
                            configData = response[0].data;
                            console.log('[Skoop Continue Sync] Parsed JSON response, extracted data field');
                        } else {
                            throw new Error('Invalid JSON response format');
                        }
                    } catch (jsonError) {
                        // If JSON parsing fails, treat the response as direct YAML
                        console.log('[Skoop Continue Sync] JSON parsing failed, treating response as direct YAML:', jsonError);
                        configData = data;
                    }

                    console.log('[Skoop Continue Sync] Config data received, processing...');
                    console.log('[Skoop Continue Sync] Config data (first 200 chars):', configData.substring(0, 200));

                    // Process the raw YAML config data
                    const teamConfig = processRawYamlConfig(configData);
                    console.log('[Skoop Continue Sync] Team configuration processed successfully');
                    resolve(teamConfig);
                } catch (error) {
                    console.error('[Skoop Continue Sync] Error parsing response:', error);
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            console.error('[Skoop Continue Sync] HTTP request error:', error);
            reject(error);
        });

        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.end();
    });
}

// Process raw YAML configuration string and extract agent information
function processRawYamlConfig(yamlContent: string): TeamConfig & { rawYaml: string } {
    const config: TeamConfig & { rawYaml: string } = {
        settings: [],
        Agents: [],
        rawYaml: yamlContent
    };

    try {
        // Simple parsing to extract settings
        const settingsMatch = yamlContent.match(/settings:\s*\n((?:  - .*\n?)*)/);
        if (settingsMatch) {
            const settingsBlock = settingsMatch[1];
            const settingsLines = settingsBlock.split('\n').filter(line => line.trim());

            let currentSetting: any = null;
            for (const line of settingsLines) {
                if (line.startsWith('  - name:')) {
                    if (currentSetting) {
                        config.settings!.push(currentSetting);
                    }
                    const name = line.match(/name:\s*"([^"]+)"/)?.[1] || '';
                    currentSetting = { name };
                } else if (currentSetting && line.includes(':')) {
                    const [key, ...valueParts] = line.trim().split(':');
                    const value = valueParts.join(':').trim();
                    if (value.startsWith('"') && value.endsWith('"')) {
                        currentSetting[key.trim()] = value.slice(1, -1);
                    } else {
                        currentSetting[key.trim()] = value;
                    }
                }
            }
            if (currentSetting) {
                config.settings!.push(currentSetting);
            }
        }

        // Extract individual agent configurations
        const agentsMatch = yamlContent.match(/Agents:\s*\n(.*)/s);
        if (agentsMatch) {
            const agentsSection = agentsMatch[1];
            // Split by agent definitions (look for lines starting with "  - agent:")
            const agentBlocks = agentsSection.split(/(?=^\s*-\s*agent:)/m);

            for (const agentBlock of agentBlocks) {
                if (!agentBlock.trim()) continue;

                const agent: Partial<AgentDefinition> & { rawYaml?: string } = {
                    agent: '',
                    name: '',
                    version: '',
                    schema: '',
                    description: '',
                    models: [],
                    rules: [],
                    prompts: [],
                    context: [],
                    docs: [],
                    mcpServers: [],
                    rawYaml: agentBlock.trim()
                };

                const lines = agentBlock.split('\n').filter(line => line.trim());

                for (const line of lines) {
                    if (line.includes('agent:')) {
                        agent.agent = line.match(/agent:\s*"([^"]+)"/)?.[1] || '';
                        agent.name = agent.agent;
                    } else if (line.includes('version:')) {
                        agent.version = line.match(/version:\s*"([^"]+)"/)?.[1] || '';
                    } else if (line.includes('schema:')) {
                        agent.schema = line.match(/schema:\s*"([^"]+)"/)?.[1] || '';
                    } else if (line.includes('description:')) {
                        agent.description = line.match(/description:\s*"([^"]+)"/)?.[1] || '';
                    }
                }

                if (agent.agent) {
                    config.Agents!.push(agent as AgentDefinition);
                }
            }
        }

        console.log('[Skoop Continue Sync] Processed config structure:', {
            settingsCount: config.settings?.length || 0,
            agentsCount: config.Agents?.length || 0
        });

    } catch (error) {
        console.error('[Skoop Continue Sync] Error processing YAML config:', error);
    }

    return config;
}

async function applyTeamSettings() {
    console.log('[Skoop Continue Sync] Finding Continue config path...');
    const configPath = await findContinueConfigPath();
    if (!configPath) {
        console.error('[Skoop Continue Sync] Could not find Continue.dev config file');
        throw new Error('Could not find Continue.dev config file. Please make sure Continue is installed and configured.');
    }
    console.log('[Skoop Continue Sync] Found config path:', configPath);

    // Fetch team configuration from HTTP endpoint
    console.log('[Skoop Continue Sync] Fetching team configuration...');
    let teamConfig: TeamConfig & { rawYaml: string };
    try {
        teamConfig = await fetchTeamConfig();
        console.log('[Skoop Continue Sync] Team configuration fetched successfully');
    } catch (error) {
        console.error('[Skoop Continue Sync] Failed to fetch team configuration:', error);
        throw new Error(`Could not fetch team configuration: ${error}`);
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

    // Process the fetched configuration
    console.log('[Skoop Continue Sync] Processing team configuration...');

    // Apply settings from the config
    if (teamConfig.settings && teamConfig.settings.length > 0) {
        console.log('[Skoop Continue Sync] Applying settings from config...');
        await configureContinueSettingsFromConfig(teamConfig.settings);
    }

    // Use the raw YAML content as the main config (contains Local Agent and other settings)
    console.log('[Skoop Continue Sync] Using raw YAML as main configuration');

    // Ensure Chromium is available for docs crawling
    console.log('[Skoop Continue Sync] Checking Chromium availability...');
    await ensureChromiumAvailable();

    // Configure VS Code Continue.dev extension settings from config
    console.log('[Skoop Continue Sync] Configuring Continue.dev extension settings...');
    await configureContinueSettingsFromConfig(teamConfig.settings || []);

    // Extract and write the Local Agent configuration as the main config
    console.log('[Skoop Continue Sync] Extracting Local Agent configuration...');

    // Find the Local Agent in the parsed agents
    const localAgent = teamConfig.Agents?.find(agent => agent.agent === 'Local Agent');
    if (!localAgent) {
        throw new Error('Local Agent configuration not found in fetched config');
    }

    // Extract the Local Agent YAML section from the raw YAML
    const localAgentYaml = extractAgentYaml(teamConfig.rawYaml, 'Local Agent');
    if (!localAgentYaml) {
        throw new Error('Could not extract Local Agent YAML from configuration');
    }

    console.log('[Skoop Continue Sync] Installing agent files...');
    await installAgentFilesFromRawConfig(configPath, teamConfig.rawYaml, teamConfig.Agents || []);

    // Force retry docs indexing to clear any previous failures
    console.log('[Skoop Continue Sync] Processing configs for docs retry...');
    forceDocsRetryForRawYaml(localAgentYaml);

    // Write the Local Agent config as the main config
    console.log('[Skoop Continue Sync] Writing Local Agent config...');
    try {
        console.log('[Skoop Continue Sync] Final config to write (first 500 chars):', localAgentYaml.substring(0, 500) + '...');
        fs.writeFileSync(configPath, localAgentYaml, 'utf8');
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

// Configure VS Code Continue.dev extension settings from config
async function configureContinueSettingsFromConfig(settings: SettingsConfig[]) {
    console.log('[Skoop Continue Sync] Configuring VS Code Continue.dev extension settings from config...');

    try {
        for (const setting of settings) {
            // Handle VSCodeSettings section
            if (setting.name === 'VSCodeSettings') {
                for (const [settingKey, desiredValue] of Object.entries(setting)) {
                    if (settingKey === 'name') continue; // Skip the name field

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
            }
        }

        console.log('[Skoop Continue Sync] Continue.dev extension settings configured successfully');
    } catch (error) {
        console.warn('[Skoop Continue Sync] Error configuring Continue.dev settings:', error);
    }
}

// Force retry docs indexing by updating timestamp for agents
function forceDocsRetryForAgents(agents: AgentDefinition[]) {
    console.log('[Skoop Continue Sync] Forcing docs retry by updating agent configurations...');

    for (const agent of agents) {
        if (agent.docs && Array.isArray(agent.docs) && agent.docs.length > 0) {
            agent.docs.forEach((doc: DocConfig) => {
                if (doc.startUrl) {
                    // Add a cache-busting parameter
                    const separator = doc.startUrl.includes('?') ? '&' : '?';
                    doc.startUrl = `${doc.startUrl}${separator}retry=${Date.now()}`;
                    console.log(`[Skoop Continue Sync] Updated docs URL to force retry: ${doc.startUrl}`);
                }
            });
        }
    }
}

// Generate YAML for an agent
function generateAgentYaml(agent: AgentDefinition): string {
    let yaml = '';

    yaml += `name: "${agent.name}"\n`;
    yaml += `version: "${agent.version}"\n`;
    yaml += `schema: "${agent.schema}"\n`;
    yaml += `description: "${agent.description}"\n\n`;

    // Add models section
    if (agent.models && agent.models.length > 0) {
        yaml += '# Models section - using LiteLLM models\n';
        yaml += 'models:\n';
        for (const model of agent.models) {
            yaml += `  - name: "${model.name || model.model}"\n`;
            if (model.provider) yaml += `    provider: ${model.provider}\n`;
            if (model.model) yaml += `    model: ${model.model}\n`;
            if (model.apiKey) yaml += `    apiKey: "${model.apiKey}"\n`;
            if (model.apiBase) yaml += `    apiBase: ${model.apiBase}\n`;
            if (model.roles && model.roles.length > 0) {
                yaml += '    roles:\n';
                for (const role of model.roles) {
                    yaml += `      - ${role}\n`;
                }
            }
            if (model.capabilities && model.capabilities.length > 0) {
                yaml += '    capabilities:\n';
                for (const capability of model.capabilities) {
                    yaml += `      - ${capability}\n`;
                }
            }
            if (model.defaultCompletionOptions) {
                yaml += '    defaultCompletionOptions:\n';
                const opts = model.defaultCompletionOptions;
                if (opts.temperature !== undefined) yaml += `      temperature: ${opts.temperature}\n`;
                if (opts.maxTokens) yaml += `      maxTokens: ${opts.maxTokens}\n`;
            }
        }
        yaml += '\n';
    }

    // Add rules section
    if (agent.rules && agent.rules.length > 0) {
        yaml += '# Rules section\n';
        yaml += 'rules:\n';
        for (const rule of agent.rules) {
            if ((rule as any).uses) {
                yaml += `  - uses: ${(rule as any).uses}\n`;
            } else {
                yaml += `  - name: "${rule.name}"\n`;
                if (rule.rule) yaml += `    rule: "${rule.rule}"\n`;
                if ((rule as any).globs) yaml += `    globs: "${(rule as any).globs}"\n`;
            }
        }
        yaml += '\n';
    }

    // Add prompts section
    if (agent.prompts && agent.prompts.length > 0) {
        yaml += '# Prompts section\n';
        yaml += 'prompts:\n';
        for (const prompt of agent.prompts) {
            if ((prompt as any).uses) {
                yaml += `  - uses: ${(prompt as any).uses}\n`;
            } else {
                yaml += `  - name: "${prompt.name}"\n`;
                if (prompt.description) yaml += `    description: "${prompt.description}"\n`;
                if (prompt.prompt) {
                    if (prompt.prompt.includes('\n')) {
                        yaml += '    prompt: |\n';
                        const lines = prompt.prompt.split('\n');
                        for (const line of lines) {
                            yaml += `      ${line}\n`;
                        }
                    } else {
                        yaml += `    prompt: "${prompt.prompt}"\n`;
                    }
                }
            }
        }
        yaml += '\n';
    }

    // Add context section
    if (agent.context && agent.context.length > 0) {
        yaml += '# Context providers section\n';
        yaml += 'context:\n';
        for (const contextItem of agent.context) {
            if ((contextItem as any).uses) {
                yaml += `  - uses: ${(contextItem as any).uses}\n`;
            } else if ((contextItem as any).provider) {
                yaml += `  - provider: ${(contextItem as any).provider}\n`;
            }
        }
        yaml += '\n';
    }

    // Add docs section
    if (agent.docs && agent.docs.length > 0) {
        yaml += '# Documentation sources\n';
        yaml += 'docs:\n';
        for (const doc of agent.docs) {
            yaml += `  - name: "${doc.name}"\n`;
            yaml += `    startUrl: ${doc.startUrl}\n`;
            if (doc.favicon) yaml += `    favicon: ${doc.favicon}\n`;
        }
        yaml += '\n';
    }

    // Add MCP Servers section
    if (agent.mcpServers && agent.mcpServers.length > 0) {
        yaml += '# MCP Servers section\n';
        yaml += 'mcpServers:\n';
        for (const mcpServer of agent.mcpServers) {
            if ((mcpServer as any).uses) {
                yaml += `  - uses: ${(mcpServer as any).uses}\n`;
            } else {
                yaml += `  - name: "${(mcpServer as any).name}"\n`;
                if ((mcpServer as any).type) yaml += `    type: ${(mcpServer as any).type}\n`;
                if ((mcpServer as any).url) yaml += `    url: ${(mcpServer as any).url}\n`;
                if ((mcpServer as any).command) yaml += `    command: ${(mcpServer as any).command}\n`;
                if ((mcpServer as any).args) {
                    yaml += '    args:\n';
                    for (const arg of (mcpServer as any).args) {
                        yaml += `      - "${arg}"\n`;
                    }
                }
            }
        }
    }

    return yaml;
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

// Setup configuration change listeners for manual triggers
function setupConfigurationListeners(context: vscode.ExtensionContext) {
    console.log('[Skoop Continue Sync] Setting up configuration listeners...');

    const onDidChangeConfiguration = vscode.workspace.onDidChangeConfiguration(async (event) => {
        // Check for applyConfig trigger
        if (event.affectsConfiguration('skoop-continue-sync.applyConfig')) {
            const applyConfig = vscode.workspace.getConfiguration('skoop-continue-sync').get('applyConfig', false);
            if (applyConfig) {
                console.log('[Skoop Continue Sync] Apply config trigger detected');
                try {
                    await applyTeamSettings();
                    // Reset the trigger back to false
                    await vscode.workspace.getConfiguration('skoop-continue-sync').update('applyConfig', false, vscode.ConfigurationTarget.Global);
                    vscode.window.showInformationMessage('Team configuration applied successfully!');
                } catch (error) {
                    console.error('[Skoop Continue Sync] Error applying config:', error);
                    vscode.window.showErrorMessage(`Failed to apply configuration: ${error}`);
                    // Reset the trigger back to false even on error
                    await vscode.workspace.getConfiguration('skoop-continue-sync').update('applyConfig', false, vscode.ConfigurationTarget.Global);
                }
            }
        }

        // Check for clearConfig trigger
        if (event.affectsConfiguration('skoop-continue-sync.clearConfig')) {
            const clearConfig = vscode.workspace.getConfiguration('skoop-continue-sync').get('clearConfig', false);
            if (clearConfig) {
                console.log('[Skoop Continue Sync] Clear config trigger detected');
                try {
                    await clearAllContinueConfigs();
                    // Reset the trigger back to false
                    await vscode.workspace.getConfiguration('skoop-continue-sync').update('clearConfig', false, vscode.ConfigurationTarget.Global);
                    vscode.window.showInformationMessage('All Continue configurations cleared successfully!');
                } catch (error) {
                    console.error('[Skoop Continue Sync] Error clearing config:', error);
                    vscode.window.showErrorMessage(`Failed to clear configurations: ${error}`);
                    // Reset the trigger back to false even on error
                    await vscode.workspace.getConfiguration('skoop-continue-sync').update('clearConfig', false, vscode.ConfigurationTarget.Global);
                }
            }
        }
    });

    context.subscriptions.push(onDidChangeConfiguration);
}

// Setup automatic config refresh
function setupAutomaticRefresh(context: vscode.ExtensionContext) {
    console.log('[Skoop Continue Sync] Setting up automatic config refresh...');

    // Store context globally for use in automatic refresh
    extensionContext = context;

    // Load last refresh time from global state
    lastConfigRefresh = context.globalState.get('lastConfigRefresh', 0);
    console.log('[Skoop Continue Sync] Last config refresh:', new Date(lastConfigRefresh).toISOString());

    // Check if we need to refresh on startup
    checkAndRefreshConfig();

    // Set up periodic refresh (every 24 hours)
    refreshTimer = setInterval(() => {
        console.log('[Skoop Continue Sync] Periodic config refresh check...');
        checkAndRefreshConfig();
    }, 24 * 60 * 60 * 1000); // 24 hours

    // Listen for when VS Code becomes active again (user comes back online)
    const onDidChangeWindowState = vscode.window.onDidChangeWindowState((state) => {
        if (state.focused && !isOnline) {
            console.log('[Skoop Continue Sync] VS Code regained focus, checking for config refresh...');
            isOnline = true;
            checkAndRefreshConfig();
        } else if (!state.focused) {
            isOnline = false;
        }
    });

    context.subscriptions.push(
        { dispose: () => onDidChangeWindowState.dispose() }
    );
}

// Global reference to extension context for state management
let extensionContext: vscode.ExtensionContext | null = null;

// Check if config needs to be refreshed and do it if necessary
async function checkAndRefreshConfig() {
    if (!extensionContext) {
        console.log('[Skoop Continue Sync] Extension context not available, skipping automatic refresh');
        return;
    }

    const userEmail = vscode.workspace.getConfiguration('skoop-continue-sync').get('userEmail', '');
    const userPassword = vscode.workspace.getConfiguration('skoop-continue-sync').get('userPassword', '');

    // Only refresh if credentials are configured
    if (!userEmail || !userPassword) {
        console.log('[Skoop Continue Sync] Skipping automatic refresh - credentials not configured');
        return;
    }

    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    if (now - lastConfigRefresh > oneDay) {
        console.log('[Skoop Continue Sync] More than 24 hours since last refresh, refreshing config...');
        try {
            await applyTeamSettings();
            lastConfigRefresh = now;
            // Save to global state
            await extensionContext.globalState.update('lastConfigRefresh', lastConfigRefresh);
            console.log('[Skoop Continue Sync] Automatic config refresh completed');
        } catch (error) {
            console.error('[Skoop Continue Sync] Automatic config refresh failed:', error);
        }
    } else {
        console.log('[Skoop Continue Sync] Config is still fresh, skipping automatic refresh');
    }
}

export function deactivate() {
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
    }
}

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


// Install agent files from raw YAML config
async function installAgentFilesFromRawConfig(configPath: string, rawYaml: string, agents: AgentDefinition[]) {
    console.log('[Skoop Continue Sync] Installing agent files from raw config...');

    const configDir = path.dirname(configPath);
    const targetAgentsDir = path.join(configDir, 'agents');

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

    // Generate and install agent files from config (excluding Local Agent which becomes the main config)
    for (const agent of agents) {
        if (agent.agent !== 'Local Agent') {
            const agentYaml = extractAgentYaml(rawYaml, agent.agent);
            if (agentYaml) {
                const fileName = `${agent.agent.toLowerCase().replace(/\s+/g, '-')}.yaml`;
                const targetPath = path.join(targetAgentsDir, fileName);

                try {
                    fs.writeFileSync(targetPath, agentYaml, 'utf8');
                    console.log(`[Skoop Continue Sync] Installed agent file: ${fileName}`);
                } catch (error) {
                    console.warn(`[Skoop Continue Sync] Could not create agent file ${fileName}:`, error);
                }
            } else {
                console.warn(`[Skoop Continue Sync] Could not extract YAML for agent: ${agent.agent}`);
            }
        }
    }

    console.log(`[Skoop Continue Sync] Installed ${agents.length - 1} agent files in ${targetAgentsDir}`);
}

// Extract agent YAML from the full configuration
function extractAgentYaml(fullYaml: string, agentName: string): string | null {
    console.log(`[Skoop Continue Sync] Extracting agent YAML for: ${agentName}`);

    // Find the Agents section
    const agentsMatch = fullYaml.match(/Agents:\s*\n(.*)/s);
    if (!agentsMatch) {
        console.error('[Skoop Continue Sync] Agents section not found in YAML');
        return null;
    }

    const agentsSection = agentsMatch[1];

    // Find the specific agent block (from - agent: line until next - agent: or end)
    const agentPattern = new RegExp(`(-\\s*agent:\\s*"${agentName}".*?)(?=\\n\\s*-\\s*agent:|$)`, 's');
    const agentMatch = agentsSection.match(agentPattern);

    if (!agentMatch) {
        console.error(`[Skoop Continue Sync] Agent "${agentName}" not found in YAML`);
        return null;
    }

    const agentBlock = agentMatch[1];

    // Split into lines and clean up
    const lines = agentBlock.split('\n');

    // Remove the first line (- agent: "Local Agent") and clean indentation
    const cleanedLines = lines.slice(1).map(line => {
        // Remove leading indentation (assuming 4 spaces: 2 for Agents level + 2 for agent level)
        if (line.startsWith('    ')) {
            return line.substring(4);
        } else if (line.startsWith('  ')) {
            return line.substring(2);
        }
        return line;
    }).filter(line => line.trim() !== '');

    // Build the final agent YAML
    const agentYaml = cleanedLines.join('\n');

    console.log(`[Skoop Continue Sync] Successfully extracted agent YAML (${agentYaml.length} characters)`);
    console.log(`[Skoop Continue Sync] First 200 chars: ${agentYaml.substring(0, 200)}`);
    return agentYaml;
}

// Force retry docs indexing for raw YAML
function forceDocsRetryForRawYaml(rawYaml: string) {
    console.log('[Skoop Continue Sync] Forcing docs retry by updating agent YAML configuration...');

    // Add a timestamp to force re-indexing of docs in the agent YAML
    const retryTimestamp = Date.now();
    const updatedYaml = rawYaml.replace(
        /(startUrl:\s*)(https?:\/\/[^&\n]*)/g,
        (match, prefix, url) => {
            const separator = url.includes('?') ? '&' : '?';
            return `${prefix}${url}${separator}retry=${retryTimestamp}`;
        }
    );

    // Update the raw YAML if any URLs were modified
    if (updatedYaml !== rawYaml) {
        console.log('[Skoop Continue Sync] Updated docs URLs to force retry');
        // Note: This function modifies the rawYaml by reference, but since it's passed by value,
        // we'd need to return it or modify the calling code. For now, we'll just log.
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