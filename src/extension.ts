import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

// Global state for automatic refresh
let lastConfigRefresh = 0;
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let isOnline = true;

// LiteLLM proxy server
let proxyServer: http.Server | null = null;
const PROXY_PORT = 8009;
const LITELLM_BASE_URL = 'https://litellm.skoop.digital';
const LITELLM_API_KEY = 'sk-Xko8_N_iN3Q_Mrda5imWQw';

export function activate(context: vscode.ExtensionContext) {
    console.log('[Skoop Continue Sync] Extension activated successfully!');
    console.log('[Skoop Continue Sync] Current workspace:', vscode.workspace.rootPath);
    console.log('[Skoop Continue Sync] Process environment:', {
        HOME: process.env.HOME,
        USERPROFILE: process.env.USERPROFILE,
        APPDATA: process.env.APPDATA
    });

    // Start LiteLLM proxy server
    startProxyServer(context);

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


// Fetch configuration from HTTP endpoint
async function fetchTeamConfig(): Promise<TeamConfig & { rawYaml: string }> {
    console.log('[Skoop Continue Sync] Fetching team configuration from endpoint...');

    const apiKey = vscode.workspace.getConfiguration('skoop-continue-sync').get('apiKey', '');

    if (!apiKey) {
        throw new Error('API key must be configured in Skoop Continue Sync settings.');
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
                'apiKey': apiKey,
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
        const settingsMatch = yamlContent.match(/settings:\s*\n(.*?)(?=\n\w|$)/s);
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
                } else if (currentSetting && currentSetting.name === 'continueignore' && line.trim() && !line.includes(':') && !line.startsWith('  -')) {
                    // Handle direct values for continueignore (patterns without keys)
                    const pattern = line.trim();
                    if (!currentSetting.patterns) {
                        currentSetting.patterns = [];
                    }
                    currentSetting.patterns.push(pattern);
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
    console.log('[Skoop Continue Sync] Finding global Continue config path...');

    // Always use global .continue directory with YAML format
    const globalContinueDir = path.join(process.env.HOME || process.env.USERPROFILE || '', '.continue');
    const configPath = path.join(globalContinueDir, 'config.yaml');

    console.log(`[Skoop Continue Sync] Using global config path: ${configPath}`);

    // Ensure the global .continue directory exists
    if (!fs.existsSync(globalContinueDir)) {
        try {
            fs.mkdirSync(globalContinueDir, { recursive: true });
            console.log('[Skoop Continue Sync] Created global .continue directory');
        } catch (error) {
            console.error('[Skoop Continue Sync] Error creating global .continue directory:', error);
            return null;
        }
    }

    console.log(`[Skoop Continue Sync] Will use config path: ${configPath}`);
    return configPath;
}

// Ensure Chromium is available for docs crawling
async function ensureChromiumAvailable() {
    console.log('[Skoop Continue Sync] Ensuring Chromium is available for docs crawling...');

    const os = require('os');
    const path = require('path');

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

            // Handle continueignore section
            if (setting.name === 'continueignore') {
                console.log('[Skoop Continue Sync] Processing continueignore settings...');

                // Get the global .continue directory path
                const globalContinueDir = path.join(process.env.HOME || process.env.USERPROFILE || '', '.continue');
                const continueIgnorePath = path.join(globalContinueDir, '.continueignore');

                // Collect all ignore patterns from the setting
                const ignorePatterns: string[] = [];

                // Check if patterns were parsed as an array
                if (setting.patterns && Array.isArray(setting.patterns)) {
                    ignorePatterns.push(...setting.patterns);
                }

                // Also check for any direct string values (fallback for other formats)
                for (const [key, value] of Object.entries(setting)) {
                    if (key === 'name' || key === 'patterns') continue; // Skip the name field and patterns array

                    // Each value should be an ignore pattern (string)
                    if (typeof value === 'string') {
                        ignorePatterns.push(value);
                    }
                }

                if (ignorePatterns.length > 0) {
                    // Write the patterns to .continueignore file
                    const ignoreContent = ignorePatterns.join('\n') + '\n';
                    fs.writeFileSync(continueIgnorePath, ignoreContent, 'utf8');
                    console.log(`[Skoop Continue Sync] Updated .continueignore file with ${ignorePatterns.length} patterns:`, ignorePatterns);
                } else {
                    console.log('[Skoop Continue Sync] No ignore patterns found in continueignore setting');
                }
            }
        }

        console.log('[Skoop Continue Sync] Continue.dev extension settings configured successfully');
    } catch (error) {
        console.warn('[Skoop Continue Sync] Error configuring Continue.dev settings:', error);
    }
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

        // Also clear any existing config.json file in the global directory
        const continueDir = path.dirname(configPath);
        const jsonConfigPath = path.join(continueDir, 'config.json');
        if (fs.existsSync(jsonConfigPath)) {
            fs.unlinkSync(jsonConfigPath);
            console.log('[Skoop Continue Sync] Removed legacy config.json file');
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
                console.log('[Skoop Continue Sync] Apply config trigger detected via settings');

                // Execute the same command as the command palette
                try {
                    await vscode.commands.executeCommand('skoop-continue-sync.applyTeamSettings');
                } catch (error) {
                    console.error('[Skoop Continue Sync] Error executing apply command:', error);
                }

                // Reset the trigger back to false
                try {
                    await vscode.workspace.getConfiguration('skoop-continue-sync').update('applyConfig', false, vscode.ConfigurationTarget.Global);
                } catch (resetError) {
                    console.error('[Skoop Continue Sync] Error resetting applyConfig setting:', resetError);
                }
            }
        }

        // Check for clearConfig trigger
        if (event.affectsConfiguration('skoop-continue-sync.clearConfig')) {
            const clearConfig = vscode.workspace.getConfiguration('skoop-continue-sync').get('clearConfig', false);
            if (clearConfig) {
                console.log('[Skoop Continue Sync] Clear config trigger detected via settings');

                // Execute the same command as the command palette
                try {
                    await vscode.commands.executeCommand('skoop-continue-sync.clearAllConfigs');
                } catch (error) {
                    console.error('[Skoop Continue Sync] Error executing clear command:', error);
                }

                // Reset the trigger back to false
                try {
                    await vscode.workspace.getConfiguration('skoop-continue-sync').update('clearConfig', false, vscode.ConfigurationTarget.Global);
                } catch (resetError) {
                    console.error('[Skoop Continue Sync] Error resetting clearConfig setting:', resetError);
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

    const apiKey = vscode.workspace.getConfiguration('skoop-continue-sync').get('apiKey', '');
    // Only refresh if credentials are configured
    if (!apiKey) {
        console.log('[Skoop Continue Sync] Skipping automatic refresh - API key not configured');
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
    
    // Stop proxy server
    if (proxyServer) {
        proxyServer.close(() => {
            console.log('[LiteLLM Proxy] Server stopped');
        });
        proxyServer = null;
    }
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

// ====================================================================================
// LiteLLM Proxy Server - Converts Anthropic format to LiteLLM/OpenAI format and back
// ====================================================================================

interface AnthropicMessage {
    role: string;
    content: string | Array<{
        type: string;
        text?: string;
        source?: any;
        tool_use_id?: string;
        [key: string]: any;
    }>;
}

interface AnthropicRequest {
    model: string;
    messages: AnthropicMessage[];
    max_tokens: number;
    stream?: boolean;
    temperature?: number;
    top_p?: number;
    system?: string | Array<any>;
    tools?: any[];
    thinking?: {
        type: string;
        budget_tokens: number;
    };
    [key: string]: any;
}

interface OpenAIRequest {
    model: string;
    messages: Array<{
        role: string;
        content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
    }>;
    stream?: boolean;
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
    tools?: any[];
    thinking?: {
        type: string;
        budget_tokens: number;
    };
    [key: string]: any;
}

function startProxyServer(context: vscode.ExtensionContext) {
    console.log('[LiteLLM Proxy] Starting proxy server on port', PROXY_PORT);

    proxyServer = http.createServer(async (req, res) => {
        const requestId = Date.now().toString();
        console.log(`[LiteLLM Proxy ${requestId}] ${req.method} ${req.url}`);

        // Enable CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        // Handle /v1/models endpoint (Anthropic-style models list)
        if (req.url === '/v1/models') {
            console.log(`[LiteLLM Proxy ${requestId}] Returning models list`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                data: [
                    {
                        id: 'anthropic/claude-sonnet-4-20250514',
                        object: 'model',
                        created: Math.floor(Date.now() / 1000),
                        owned_by: 'anthropic'
                    }
                ],
                object: 'list'
            }));
            return;
        }

        // Handle /v1/messages endpoint (Anthropic chat completions)
        if (req.url === '/v1/messages' || req.url === '/v1/chat/completions') {
            if (req.method !== 'POST') {
                res.writeHead(405, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Method not allowed' }));
                return;
            }

            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });

            req.on('end', async () => {
                try {
                    const anthropicRequest: AnthropicRequest = JSON.parse(body);
                    console.log(`[LiteLLM Proxy ${requestId}] Anthropic request:`, JSON.stringify(anthropicRequest, null, 2));

                    // Convert Anthropic format to OpenAI format
                    const openaiRequest = convertAnthropicToOpenAI(anthropicRequest);
                    console.log(`[LiteLLM Proxy ${requestId}] OpenAI request:`, JSON.stringify(openaiRequest, null, 2));

                    // Determine the correct LiteLLM endpoint
                    const litellmUrl = `${LITELLM_BASE_URL}/v1/chat/completions`;

                    // Make request to LiteLLM
                    await forwardToLiteLLM(litellmUrl, openaiRequest, res, requestId, anthropicRequest.stream || false);

                } catch (error) {
                    console.error(`[LiteLLM Proxy ${requestId}] Error:`, error);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ 
                        type: 'error',
                        error: {
                            type: 'internal_error',
                            message: error instanceof Error ? error.message : String(error)
                        }
                    }));
                }
            });
            return;
        }

        // Unknown endpoint
        console.log(`[LiteLLM Proxy ${requestId}] Unknown endpoint:`, req.url);
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
    });

    proxyServer.on('error', (error) => {
        console.error('[LiteLLM Proxy] Server error:', error);
        vscode.window.showErrorMessage(`LiteLLM Proxy error: ${error.message}`);
    });

    proxyServer.listen(PROXY_PORT, 'localhost', () => {
        console.log(`[LiteLLM Proxy] Server listening on http://localhost:${PROXY_PORT}`);
        vscode.window.showInformationMessage(`LiteLLM Proxy started on port ${PROXY_PORT}`);
    });

    context.subscriptions.push({
        dispose: () => {
            if (proxyServer) {
                proxyServer.close();
            }
        }
    });
}

function convertAnthropicToOpenAI(anthropicRequest: AnthropicRequest): OpenAIRequest {
    const openaiRequest: OpenAIRequest = {
        model: anthropicRequest.model,
        messages: [],
        stream: anthropicRequest.stream || false,
        max_tokens: anthropicRequest.max_tokens
    };

    // Extract system message if present
    let systemMessage: string | undefined;
    if (anthropicRequest.system) {
        if (typeof anthropicRequest.system === 'string') {
            systemMessage = anthropicRequest.system;
        } else if (Array.isArray(anthropicRequest.system)) {
            // Handle system message blocks
            systemMessage = anthropicRequest.system
                .map((block: any) => block.text || '')
                .join('\n');
        }
    }

    // Convert messages
    openaiRequest.messages = anthropicRequest.messages.map(msg => {
        // Handle content blocks (Anthropic format)
        if (Array.isArray(msg.content)) {
            const textBlocks = msg.content.filter((block: any) => block.type === 'text');
            const imageBlocks = msg.content.filter((block: any) => block.type === 'image');
            
            if (imageBlocks.length > 0) {
                // Convert to OpenAI's vision format
                const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];
                
                textBlocks.forEach((block: any) => {
                    content.push({ type: 'text', text: block.text });
                });
                
                imageBlocks.forEach((block: any) => {
                    const source = block.source;
                    let imageUrl = '';
                    if (source.type === 'base64') {
                        imageUrl = `data:${source.media_type};base64,${source.data}`;
                    } else if (source.type === 'url') {
                        imageUrl = source.url;
                    }
                    content.push({ type: 'image_url', image_url: { url: imageUrl } });
                });

                return { role: msg.role, content: content as any };
            } else {
                // Text only
                const text = textBlocks.map((b: any) => b.text).join('\n');
                return { role: msg.role, content: text };
            }
        }

        // Simple string content
        return {
            role: msg.role,
            content: msg.content as string
        };
    });

    // Add system message as first message if present
    if (systemMessage) {
        openaiRequest.messages.unshift({
            role: 'system',
            content: systemMessage
        });
    }

    // Copy parameters
    if (anthropicRequest.temperature !== undefined) {
        openaiRequest.temperature = anthropicRequest.temperature;
    }
    if (anthropicRequest.top_p !== undefined) {
        openaiRequest.top_p = anthropicRequest.top_p;
    }

    // Add tools if present
    if (anthropicRequest.tools) {
        openaiRequest.tools = anthropicRequest.tools;
    }

    // Pass through thinking parameter or add it for Claude/Anthropic models
    if (anthropicRequest.thinking) {
        openaiRequest.thinking = anthropicRequest.thinking;
    } else if (anthropicRequest.model.includes('claude') || anthropicRequest.model.includes('anthropic')) {
        const thinkingBudget = 2048;
        const requestedMaxTokens = openaiRequest.max_tokens || 30000;
        
        // Only add thinking if max_tokens is large enough
        if (requestedMaxTokens > thinkingBudget) {
            openaiRequest.thinking = {
                type: 'enabled',
                budget_tokens: thinkingBudget
            };
            console.log(`[LiteLLM Proxy] Adding thinking with budget ${thinkingBudget}, max_tokens: ${requestedMaxTokens}`);
        } else {
            console.log(`[LiteLLM Proxy] Skipping thinking: max_tokens (${requestedMaxTokens}) <= budget (${thinkingBudget})`);
        }
    }

    return openaiRequest;
}

async function forwardToLiteLLM(
    url: string, 
    openaiRequest: OpenAIRequest, 
    res: http.ServerResponse,
    requestId: string,
    isStreaming: boolean
) {
    const urlObj = new URL(url);
    
    const requestBody = JSON.stringify(openaiRequest);
    console.log(`[LiteLLM Proxy ${requestId}] Forwarding to ${url}`);

    const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${LITELLM_API_KEY}`,
            'Content-Length': Buffer.byteLength(requestBody)
        }
    };

    const protocol = urlObj.protocol === 'https:' ? https : http;

    const litellmReq = protocol.request(options, (litellmRes) => {
        console.log(`[LiteLLM Proxy ${requestId}] LiteLLM response status:`, litellmRes.statusCode);

        // Handle error responses
        if (litellmRes.statusCode && (litellmRes.statusCode < 200 || litellmRes.statusCode >= 300)) {
            let errorData = '';
            const errorStatusCode = litellmRes.statusCode;
            litellmRes.on('data', (chunk) => {
                errorData += chunk.toString();
            });
            litellmRes.on('end', () => {
                console.error(`[LiteLLM Proxy ${requestId}] LiteLLM error response (${errorStatusCode}):`, errorData);
                res.writeHead(errorStatusCode, { 'Content-Type': 'application/json' });
                res.end(errorData || JSON.stringify({ error: 'LiteLLM request failed', status: errorStatusCode }));
            });
            return;
        }

        if (isStreaming) {
            // Handle streaming response in Anthropic SSE format
            res.writeHead(litellmRes.statusCode || 200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            });

            let buffer = '';
            let messageStartSent = false;

            litellmRes.on('data', (chunk) => {
                buffer += chunk.toString();
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                lines.forEach(line => {
                    if (line.trim().startsWith('data: ')) {
                        const data = line.trim().substring(6);
                        
                        if (data === '[DONE]') {
                            console.log(`[LiteLLM Proxy ${requestId}] Stream complete`);
                            return;
                        }

                        try {
                            const parsed = JSON.parse(data);
                            const choice = parsed.choices?.[0];
                            const delta = choice?.delta;
                            
                            // Log if we're getting reasoning content
                            if (delta?.reasoning_content) {
                                console.log(`[LiteLLM Proxy ${requestId}] *** REASONING CONTENT DETECTED ***:`, delta.reasoning_content.substring(0, 100));
                            }
                            
                            console.log(`[LiteLLM Proxy ${requestId}] Stream chunk delta:`, JSON.stringify(delta).substring(0, 200));
                            
                            // Convert OpenAI stream format to Anthropic format
                            const anthropicEvents = convertOpenAIStreamToAnthropic(parsed, messageStartSent, requestId);
                            if (anthropicEvents.length > 0 && !messageStartSent) {
                                messageStartSent = true;
                            }
                            
                            // Log how many events we're about to send
                            console.log(`[LiteLLM Proxy ${requestId}] 📤 Sending ${anthropicEvents.length} SSE events`);
                            
                            anthropicEvents.forEach(event => {
                                const eventType = event.type;
                                
                                // Determine what to send in the data field based on event type
                                let eventData: any;
                                if (eventType === 'message_start') {
                                    // For message_start, data is the message object
                                    eventData = event.message;
                                } else {
                                    // For other events, data is everything except type
                                    const { type, ...rest } = event;
                                    eventData = rest;
                                }
                                
                                // Write SSE event in Anthropic's exact format
                                const sseEvent = `event: ${eventType}\ndata: ${JSON.stringify(eventData)}\n\n`;
                                res.write(sseEvent);
                                
                                // Log every event being sent
                                console.log(`[LiteLLM Proxy ${requestId}] 📨 SSE: event=${eventType}, data=${JSON.stringify(eventData).substring(0, 100)}`);
                                
                                // Log tool_use events for debugging
                                if (eventType === 'content_block_start' && eventData.content_block?.type === 'tool_use') {
                                    console.log(`[LiteLLM Proxy ${requestId}] ⚙️ TOOL_USE START:`, eventData.content_block.name);
                                }
                                if (eventType === 'message_delta' && eventData.delta?.stop_reason === 'tool_use') {
                                    console.log(`[LiteLLM Proxy ${requestId}] 🛑 STOP_REASON: tool_use - Continue should execute tools now!`);
                                }
                            });
                        } catch (e) {
                            console.error(`[LiteLLM Proxy ${requestId}] Error parsing stream chunk:`, e);
                        }
                    }
                });
            });

            litellmRes.on('end', () => {
                console.log(`[LiteLLM Proxy ${requestId}] Stream ended`);
                
                // Send message_stop event (empty object is correct for Anthropic)
                res.write(`event: message_stop\n`);
                res.write(`data: {}\n\n`);
                res.end();
                
                // Clean up any remaining state
                if (requestId) {
                    streamState.delete(requestId);
                }
            });

        } else {
            // Handle non-streaming response
            let data = '';

            litellmRes.on('data', (chunk) => {
                data += chunk.toString();
            });

            litellmRes.on('end', () => {
                try {
                    const openaiResponse = JSON.parse(data);
                    const message = openaiResponse.choices?.[0]?.message;
                    
                    // Log if we're getting reasoning content
                    if (message?.reasoning_content) {
                        console.log(`[LiteLLM Proxy ${requestId}] *** REASONING CONTENT DETECTED ***:`, message.reasoning_content.substring(0, 200));
                    } else {
                        console.log(`[LiteLLM Proxy ${requestId}] No reasoning_content in response`);
                    }
                    
                    console.log(`[LiteLLM Proxy ${requestId}] OpenAI response message:`, JSON.stringify(message).substring(0, 300));

                    // Convert OpenAI response to Anthropic format
                    const anthropicResponse = convertOpenAIToAnthropic(openaiResponse);
                    console.log(`[LiteLLM Proxy ${requestId}] Anthropic response:`, JSON.stringify(anthropicResponse).substring(0, 500));

                    res.writeHead(litellmRes.statusCode || 200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(anthropicResponse));
                } catch (error) {
                    console.error(`[LiteLLM Proxy ${requestId}] Error parsing response:`, error);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ 
                        type: 'error',
                        error: {
                            type: 'internal_error',
                            message: error instanceof Error ? error.message : String(error)
                        }
                    }));
                }
            });
        }
    });

    litellmReq.on('error', (error) => {
        console.error(`[LiteLLM Proxy ${requestId}] Request error:`, error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            error: 'Error contacting LiteLLM',
            details: error.message
        }));
    });

    litellmReq.write(requestBody);
    litellmReq.end();
}

function convertOpenAIToAnthropic(openaiResponse: any): any {
    const choice = openaiResponse.choices?.[0];
    if (!choice) {
        return {
            id: openaiResponse.id || `msg_${Date.now()}`,
            type: 'message',
            role: 'assistant',
            content: [],
            model: openaiResponse.model,
            stop_reason: 'end_turn',
            usage: {
                input_tokens: 0,
                output_tokens: 0
            }
        };
    }

    const message = choice.message;
    const anthropicResponse: any = {
        id: openaiResponse.id || `msg_${Date.now()}`,
        type: 'message',
        role: 'assistant',
        model: openaiResponse.model,
        stop_reason: choice.finish_reason === 'tool_calls' ? 'tool_use' : 'end_turn'
    };

    // Build content blocks
    const contentBlocks: any[] = [];

    // Add thinking blocks if present
    if (message.thinking_blocks && Array.isArray(message.thinking_blocks)) {
        message.thinking_blocks.forEach((block: any) => {
            contentBlocks.push({
                type: 'thinking',
                thinking: block.thinking
            });
        });
        console.log(`[LiteLLM Proxy] Added ${message.thinking_blocks.length} thinking blocks to response`);
    }

    // Add text content
    if (message.content) {
        contentBlocks.push({
            type: 'text',
            text: message.content
        });
    }

    // Add tool use blocks if present
    if (message.tool_calls && Array.isArray(message.tool_calls)) {
        message.tool_calls.forEach((toolCall: any) => {
            contentBlocks.push({
                type: 'tool_use',
                id: toolCall.id,
                name: toolCall.function.name,
                input: JSON.parse(toolCall.function.arguments || '{}')
            });
        });
    }

    anthropicResponse.content = contentBlocks;

    // Add usage information
    if (openaiResponse.usage) {
        anthropicResponse.usage = {
            input_tokens: openaiResponse.usage.prompt_tokens || 0,
            output_tokens: openaiResponse.usage.completion_tokens || 0
        };
    }

    return anthropicResponse;
}

// Track content blocks across chunks (needs to be stateful per request)
const streamState = new Map<string, {
    thinkingStarted: boolean;
    textStarted: boolean;
    toolStarted: Set<string>;
}>();

function convertOpenAIStreamToAnthropic(openaiChunk: any, messageStartSent: boolean, requestId?: string): any[] {
    const events: any[] = [];
    const choice = openaiChunk.choices?.[0];
    
    if (!choice) {
        return events;
    }

    // Initialize or get stream state for this request
    const stateKey = requestId || 'default';
    if (!streamState.has(stateKey)) {
        streamState.set(stateKey, {
            thinkingStarted: false,
            textStarted: false,
            toolStarted: new Set()
        });
    }
    const state = streamState.get(stateKey)!;

    // Send message_start event if not sent yet
    if (!messageStartSent) {
        events.push({
            type: 'message_start',
            message: {
                id: openaiChunk.id || `msg_${Date.now()}`,
                type: 'message',
                role: 'assistant',
                content: [],
                model: openaiChunk.model,
                stop_reason: null,
                stop_sequence: null,
                usage: { input_tokens: 0, output_tokens: 0 }
            }
        });
    }

    const delta = choice.delta;

    // Handle thinking/reasoning content
    if (delta.thinking_blocks && Array.isArray(delta.thinking_blocks)) {
        delta.thinking_blocks.forEach((block: any) => {
            if (!state.thinkingStarted && block.thinking) {
                events.push({
                    type: 'content_block_start',
                    index: 0,
                    content_block: {
                        type: 'thinking',
                        thinking: ''
                    }
                });
                state.thinkingStarted = true;
            }
            
            if (block.thinking) {
                events.push({
                    type: 'content_block_delta',
                    index: 0,
                    delta: {
                        type: 'thinking_delta',
                        thinking: block.thinking
                    }
                });
            }
            
            // Check if thinking block is complete (has signature)
            if (block.signature) {
                events.push({
                    type: 'content_block_stop',
                    index: 0
                });
                state.thinkingStarted = false;
                console.log('[LiteLLM Proxy] Completed thinking block');
            }
        });
    } else if (delta.reasoning_content) {
        if (!state.thinkingStarted) {
            events.push({
                type: 'content_block_start',
                index: 0,
                content_block: {
                    type: 'thinking',
                    thinking: ''
                }
            });
            state.thinkingStarted = true;
        }
        
        events.push({
            type: 'content_block_delta',
            index: 0,
            delta: {
                type: 'thinking_delta',
                thinking: delta.reasoning_content
            }
        });
    }

    // Handle text content
    if (delta.content) {
        if (!state.textStarted) {
            events.push({
                type: 'content_block_start',
                index: 1,
                content_block: {
                    type: 'text',
                    text: ''
                }
            });
            state.textStarted = true;
        }
        
        events.push({
            type: 'content_block_delta',
            index: 1,
            delta: {
                type: 'text_delta',
                text: delta.content
            }
        });
    }

    // Handle tool calls
    if (delta.tool_calls && Array.isArray(delta.tool_calls)) {
        delta.tool_calls.forEach((toolCall: any, idx: number) => {
            if (toolCall.id && toolCall.function && toolCall.function.name) {
                const toolId = toolCall.id;
                const toolIndex = idx + 2;
                
                if (!state.toolStarted.has(toolId)) {
                    events.push({
                        type: 'content_block_start',
                        index: toolIndex,
                        content_block: {
                            type: 'tool_use',
                            id: toolCall.id,
                            name: toolCall.function.name,
                            input: {}
                        }
                    });
                    state.toolStarted.add(toolId);
                }
                
                if (toolCall.function.arguments) {
                    events.push({
                        type: 'content_block_delta',
                        index: toolIndex,
                        delta: {
                            type: 'input_json_delta',
                            partial_json: toolCall.function.arguments
                        }
                    });
                }
            }
        });
    }

    // Handle finish_reason - send stop events for all blocks before message_delta
    if (choice.finish_reason) {
        // Stop thinking block if still open
        if (state.thinkingStarted) {
            events.push({
                type: 'content_block_stop',
                index: 0
            });
        }
        
        // Stop text block if it was started
        if (state.textStarted) {
            events.push({
                type: 'content_block_stop',
                index: 1
            });
        }
        
        // Stop all tool blocks
        let toolIdx = 0;
        state.toolStarted.forEach(() => {
            events.push({
                type: 'content_block_stop',
                index: toolIdx + 2
            });
            console.log(`[LiteLLM Proxy] Stopped tool block at index ${toolIdx + 2}`);
            toolIdx++;
        });
        
        const stopReason = choice.finish_reason === 'tool_calls' ? 'tool_use' : 'end_turn';
        events.push({
            type: 'message_delta',
            delta: {
                stop_reason: stopReason,
                stop_sequence: null
            },
            usage: { output_tokens: 1 }
        });
        
        console.log(`[LiteLLM Proxy] Message finished with stop_reason: ${stopReason}`);
        
        // Clear state for this request
        streamState.delete(stateKey);
    }

    return events;
}

