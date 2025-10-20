import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

// Global state for automatic refresh
let lastConfigRefresh = 0;
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let isOnline = true;

// Global state for auto-update
let lastUpdateCheck = 0;
let updateCheckTimer: ReturnType<typeof setInterval> | null = null;
let latestVersion: string | null = null;
let updateAvailable = false;

// Logging utility
function log(message: string, verboseOnly: boolean = false) {
    if (!verboseOnly || vscode.workspace.getConfiguration('skoop-continue-sync').get('verboseLogging', false)) {
        console.log(`[Skoop Continue Sync] ${message}`);
    }
}

export function activate(context: vscode.ExtensionContext) {
    log('Extension activated successfully!');

    // Check current extension detection (verbose only)
    const currentVersion = getCurrentVersion();
    log(`Current version: ${currentVersion}`, true);

    // Check update settings (verbose only)
    const enableAutoUpdates = vscode.workspace.getConfiguration('skoop-continue-sync').get('enableAutoUpdates', true);
    const refreshInterval = vscode.workspace.getConfiguration('skoop-continue-sync').get('refreshInterval', 10);
    log(`Auto-updates: ${enableAutoUpdates}, Refresh interval: ${refreshInterval}s`, true);

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

    const checkUpdatesDisposable = vscode.commands.registerCommand('skoop-continue-sync.checkForUpdates', async () => {
        console.log('[Skoop Continue Sync] Check for updates command triggered');
        await manualUpdateCheck();
    });

    const installUpdateDisposable = vscode.commands.registerCommand('skoop-continue-sync.installUpdate', async () => {
        console.log('[Skoop Continue Sync] Install update command triggered');

        try {
            // Always check for updates first to get the latest info
            const updateInfo = await checkForUpdates();
            if (!updateInfo) {
                vscode.window.showErrorMessage('Could not check for updates. Please try again later.');
                return;
            }

            const currentVersion = getCurrentVersion();
            const comparison = compareVersions(updateInfo.version, currentVersion);

            if (comparison > 0) {
                // There is an update available
                await installUpdate(updateInfo.downloadUrl, updateInfo.version);
            } else if (comparison === 0) {
                vscode.window.showInformationMessage('Your extension is already up to date!');
            } else {
                vscode.window.showInformationMessage('Your extension version is newer than the latest release.');
            }
        } catch (error) {
            console.error('[Skoop Continue Sync] Error in install update command:', error);
            vscode.window.showErrorMessage(`Failed to check for updates: ${error}`);
        }
    });

    const forceUpdateCheckDisposable = vscode.commands.registerCommand('skoop-continue-sync.forceUpdateCheck', async () => {
        log('Force update check triggered', true);
        try {
            // Force update check by temporarily resetting lastUpdateCheck
            const originalLastUpdateCheck = lastUpdateCheck;
            lastUpdateCheck = 0; // Force the check
            await checkAndNotifyUpdates();
            lastUpdateCheck = originalLastUpdateCheck; // Restore original value
            log('Force update check completed', true);
        } catch (error) {
            console.error('[Skoop Continue Sync] Force update check failed:', error);
        }
    });

    const updateStatusDisposable = vscode.commands.registerCommand('skoop-continue-sync.updateStatus', async () => {
        log('Update status command triggered', true);

        const currentVersion = getCurrentVersion();
        const enableAutoUpdates = vscode.workspace.getConfiguration('skoop-continue-sync').get('enableAutoUpdates', true);
        const refreshInterval = vscode.workspace.getConfiguration('skoop-continue-sync').get('refreshInterval', 10);

        const status = {
            currentVersion,
            enableAutoUpdates,
            refreshInterval,
            updateAvailable,
            latestVersion,
            lastUpdateCheck: new Date(lastUpdateCheck).toISOString(),
            updateCheckTimerRunning: !!updateCheckTimer,
            configRefreshTimerRunning: !!refreshTimer,
            extensionContextAvailable: !!extensionContext
        };

        log(`Status: v${currentVersion}, auto=${enableAutoUpdates}, interval=${refreshInterval}s`, true);
        vscode.window.showInformationMessage(`Update Status: ${JSON.stringify(status, null, 2)}`);
    });

    context.subscriptions.push(applySettingsDisposable, clearConfigDisposable, checkUpdatesDisposable, installUpdateDisposable, forceUpdateCheckDisposable, updateStatusDisposable);
    log('All commands registered successfully', true);
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

        // Clear legacy config.json
        const continueDir = path.dirname(configPath);
        const jsonConfigPath = path.join(continueDir, 'config.json');
        if (fs.existsSync(jsonConfigPath)) {
            fs.unlinkSync(jsonConfigPath);
            console.log('[Skoop Continue Sync] Removed legacy config.json file');
        }

        // Clear all subdirectories
        const subDirs = ['agents', 'models', 'rules', 'prompts', 'docs', 'mcpServers'];
        for (const subDir of subDirs) {
            const dirPath = path.join(continueDir, subDir);
            if (fs.existsSync(dirPath)) {
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
        console.log('[Skoop Continue Sync] Cleared all Continue subdirectories');
    } catch (error) {
        console.warn('[Skoop Continue Sync] Could not clear existing config files/directories:', error);
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
    log('Setting up configuration listeners...', true);

    const onDidChangeConfiguration = vscode.workspace.onDidChangeConfiguration(async (event) => {
        log('Configuration change detected', true);

        // Check for applyConfig trigger
        if (event.affectsConfiguration('skoop-continue-sync.applyConfig')) {
            const applyConfig = vscode.workspace.getConfiguration('skoop-continue-sync').get('applyConfig', false);
            if (applyConfig) {
                log('Apply config trigger detected via settings', true);

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
                log('Clear config trigger detected via settings', true);

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

        // Check for checkForUpdates trigger
        if (event.affectsConfiguration('skoop-continue-sync.checkForUpdates')) {
            const checkForUpdates = vscode.workspace.getConfiguration('skoop-continue-sync').get('checkForUpdates', false);
            log(`Check for updates trigger: ${checkForUpdates}`, true);
            if (checkForUpdates) {
                // Execute the check for updates command
                try {
                    await vscode.commands.executeCommand('skoop-continue-sync.checkForUpdates');
                } catch (error) {
                    console.error('[Skoop Continue Sync] Error executing check for updates command:', error);
                }

                // Reset the trigger back to false
                try {
                    await vscode.workspace.getConfiguration('skoop-continue-sync').update('checkForUpdates', false, vscode.ConfigurationTarget.Global);
                } catch (resetError) {
                    console.error('[Skoop Continue Sync] Error resetting checkForUpdates setting:', resetError);
                }
            }
        }

        // Check for installUpdate trigger
        if (event.affectsConfiguration('skoop-continue-sync.installUpdate')) {
            const installUpdate = vscode.workspace.getConfiguration('skoop-continue-sync').get('installUpdate', false);
            log(`Install update trigger: ${installUpdate}`, true);
            if (installUpdate) {
                // Execute the install update command
                try {
                    await vscode.commands.executeCommand('skoop-continue-sync.installUpdate');
                } catch (error) {
                    console.error('[Skoop Continue Sync] Error executing install update command:', error);
                }

                // Reset the trigger back to false
                try {
                    await vscode.workspace.getConfiguration('skoop-continue-sync').update('installUpdate', false, vscode.ConfigurationTarget.Global);
                } catch (resetError) {
                    console.error('[Skoop Continue Sync] Error resetting installUpdate setting:', resetError);
                }
            }
        }

        // Check for refreshInterval change
        if (event.affectsConfiguration('skoop-continue-sync.refreshInterval')) {
            const newInterval = vscode.workspace.getConfiguration('skoop-continue-sync').get('refreshInterval', 10);
            log(`Refresh interval changed to: ${newInterval}s`, true);
            startConfigRefreshTimer();
            startUpdateCheckTimer();
        }

        // Check for enableAutoUpdates change
        if (event.affectsConfiguration('skoop-continue-sync.enableAutoUpdates')) {
            const enableAutoUpdates = vscode.workspace.getConfiguration('skoop-continue-sync').get('enableAutoUpdates', true);
            log(`Auto-updates ${enableAutoUpdates ? 'enabled' : 'disabled'}`, true);
            if (enableAutoUpdates) {
                startUpdateCheckTimer();
            } else {
                stopUpdateCheckTimer();
            }
        }

        // Check for API key change
        if (event.affectsConfiguration('skoop-continue-sync.apiKey')) {
            const apiKey = vscode.workspace.getConfiguration('skoop-continue-sync').get('apiKey', '');
            if (apiKey) {
                log('API key configured or changed, applying team settings automatically', true);
                try {
                    await applyTeamSettings();
                } catch (error) {
                    console.error('[Skoop Continue Sync] Auto-apply after API key change failed:', error);
                    vscode.window.showErrorMessage(`Failed to apply team settings after API key update: ${error}`);
                }
            }
        }
    });

    context.subscriptions.push(onDidChangeConfiguration);
}

// Start the config refresh timer with current configuration
function startConfigRefreshTimer() {
    // Clear existing timer if running
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
    }

    const refreshInterval = vscode.workspace.getConfiguration('skoop-continue-sync').get('refreshInterval', 10) * 1000;

    log(`Starting config refresh timer (${refreshInterval / 1000}s interval)`, true);
    refreshTimer = setInterval(() => {
        log('Periodic config refresh check...', true);
        checkAndRefreshConfig();
    }, refreshInterval);
}

// Start the update check timer with current configuration
function startUpdateCheckTimer() {
    // Clear existing timer if running
    if (updateCheckTimer) {
        clearInterval(updateCheckTimer);
        updateCheckTimer = null;
    }

    const enableAutoUpdates = vscode.workspace.getConfiguration('skoop-continue-sync').get('enableAutoUpdates', true);
    if (!enableAutoUpdates) {
        log('Auto-updates disabled, not starting update check timer', true);
        return;
    }

    const refreshInterval = vscode.workspace.getConfiguration('skoop-continue-sync').get('refreshInterval', 10) * 1000;

    log(`Starting update check timer (${refreshInterval / 1000}s interval)`, true);
    updateCheckTimer = setInterval(() => {
        log('Periodic update check...', true);
        checkAndNotifyUpdates();
    }, refreshInterval);
}

// Stop the update check timer
function stopUpdateCheckTimer() {
    if (updateCheckTimer) {
        log('Stopping update check timer', true);
        clearInterval(updateCheckTimer);
        updateCheckTimer = null;
    }
}

// Setup automatic config refresh and update checking
function setupAutomaticRefresh(context: vscode.ExtensionContext) {
    log('Setting up automatic refresh and update checking...', true);

    // Store context globally for use in automatic refresh
    extensionContext = context;

    // Load last refresh time from global state
    lastConfigRefresh = context.globalState.get('lastConfigRefresh', 0);
    lastUpdateCheck = context.globalState.get('lastUpdateCheck', 0);

    // Check for updates and config on startup
    checkAndRefreshConfig();
    checkAndNotifyUpdates();

    // Start both timers with configurable intervals
    startConfigRefreshTimer();
    startUpdateCheckTimer();

    // Listen for when VS Code becomes active again (user comes back online)
    const onDidChangeWindowState = vscode.window.onDidChangeWindowState((state) => {
        if (state.focused && !isOnline) {
            log('VS Code regained focus, checking if refresh needed...', true);
            isOnline = true;
            checkAndRefreshConfig();
            checkAndNotifyUpdates();
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
        log('Extension context not available, skipping automatic refresh', true);
        return;
    }

    const apiKey = vscode.workspace.getConfiguration('skoop-continue-sync').get('apiKey', '');
    // Only refresh if credentials are configured
    if (!apiKey) {
        log('Skipping automatic refresh - API key not configured', true);
        return;
    }

    const now = Date.now();
    const refreshInterval = vscode.workspace.getConfiguration('skoop-continue-sync').get('refreshInterval', 10) * 1000;

    if (now - lastConfigRefresh > refreshInterval) {
        log('Refreshing config...', true);
        try {
            await applyTeamSettings();
            lastConfigRefresh = now;
            // Save to global state
            await extensionContext.globalState.update('lastConfigRefresh', lastConfigRefresh);
            log('Config refresh completed', true);
        } catch (error) {
            console.error('[Skoop Continue Sync] Config refresh failed:', error);
        }
    } else {
        log(`Config still fresh (${Math.round((refreshInterval - (now - lastConfigRefresh)) / 1000)}s remaining)`, true);
    }
}

export function deactivate() {
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
    }
    if (updateCheckTimer) {
        clearInterval(updateCheckTimer);
        updateCheckTimer = null;
    }
}

// Auto-update functionality

// Check for latest version from GitHub releases
async function checkForUpdates(): Promise<{ version: string; downloadUrl: string } | null> {
    try {
        console.log('[Skoop Continue Sync] Checking for extension updates...');

        const owner = 'SKOOP-Digital';  // Repository owner
        const repo = 'skoop-continue-sync';
        const url = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;

        console.log('[Skoop Continue Sync] Making request to:', url);

        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'api.github.com',
                path: `/repos/${owner}/${repo}/releases/latest`,
                method: 'GET',
                headers: {
                    'User-Agent': 'Skoop-Continue-Sync-Extension',
                    'Accept': 'application/vnd.github.v3+json'
                }
            };

            console.log('[Skoop Continue Sync] HTTPS request options:', JSON.stringify(options, null, 2));

            const req = https.request(options, (res) => {
                console.log('[Skoop Continue Sync] GitHub API response status:', res.statusCode);
                console.log('[Skoop Continue Sync] Response headers:', JSON.stringify(res.headers, null, 2));

                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    console.log('[Skoop Continue Sync] Raw response data length:', data.length);
                    console.log('[Skoop Continue Sync] Raw response data (first 500 chars):', data.substring(0, 500));

                    try {
                        if (res.statusCode === 200) {
                            const release = JSON.parse(data);
                            console.log('[Skoop Continue Sync] Parsed release data:', {
                                tag_name: release.tag_name,
                                assets_count: release.assets?.length || 0
                            });

                            const version = release.tag_name.replace(/^v/, ''); // Remove 'v' prefix if present
                            console.log('[Skoop Continue Sync] Extracted version from tag:', version);

                            // If version already contains dots, use it directly. Otherwise convert build number to semantic version.
                            let semanticVersion: string;
                            if (version.includes('.')) {
                                // Already a semantic version (e.g., "0.1.92")
                                semanticVersion = version;
                                console.log('[Skoop Continue Sync] Using semantic version directly:', semanticVersion);
                            } else {
                                // Convert build number to semantic version format (0.1.X)
                                const buildNumber = parseInt(version);
                                semanticVersion = `0.1.${buildNumber}`;
                                console.log('[Skoop Continue Sync] Converted build number to semantic version:', semanticVersion);
                            }

                            const asset = release.assets.find((a: any) => a.name === 'skoop-continue-sync.vsix');
                            console.log('[Skoop Continue Sync] Found .vsix asset:', asset ? asset.name : 'none');

                            if (asset) {
                                const result = {
                                    version: semanticVersion,
                                    downloadUrl: asset.browser_download_url
                                };
                                console.log('[Skoop Continue Sync] Returning update info:', result);
                                resolve(result);
                            } else {
                                console.log('[Skoop Continue Sync] No .vsix asset found in latest release');
                                resolve(null);
                            }
                        } else {
                            console.log(`[Skoop Continue Sync] GitHub API returned status ${res.statusCode}`);
                            console.log('[Skoop Continue Sync] Response body:', data);
                            resolve(null);
                        }
                    } catch (error) {
                        console.error('[Skoop Continue Sync] Error parsing GitHub API response:', error);
                        console.error('[Skoop Continue Sync] Raw response data:', data);
                        reject(error);
                    }
                });
            });

            req.on('error', (error) => {
                console.error('[Skoop Continue Sync] HTTPS request error:', error);
                reject(error);
            });

            req.setTimeout(10000, () => {
                console.log('[Skoop Continue Sync] Update check request timed out');
                req.destroy();
                reject(new Error('Update check timeout'));
            });

            console.log('[Skoop Continue Sync] Sending HTTPS request...');
            req.end();
        });
    } catch (error) {
        console.error('[Skoop Continue Sync] Failed to check for updates:', error);
        return null;
    }
}

// Get current extension version
function getCurrentVersion(): string {
    // Try different possible extension IDs
    const possibleIds = [
        'skoop-continue-sync',  // Just name
        'SKOOP-Digital.skoop-continue-sync',  // Publisher.name
        'JoshS.skoop-continue-sync',  // From repository URL
        'undefined_publisher.skoop-continue-sync'  // Manually installed
    ];

    console.log('[Skoop Continue Sync] Looking for extension with possible IDs:', possibleIds);

    // First try exact matches
    for (const id of possibleIds) {
        const extension = vscode.extensions.getExtension(id);
        if (extension) {
            const version = extension.packageJSON?.version || '0.0.0';
            console.log('[Skoop Continue Sync] ✅ Found extension with exact ID:', id);
            console.log('[Skoop Continue Sync] Current extension version:', version);
            console.log('[Skoop Continue Sync] Extension path:', extension.extensionPath);
            return version;
        }
    }

    // Try partial matches for manually installed extensions
    const allExtensions = vscode.extensions.all;
    for (const ext of allExtensions) {
        if (ext.id.includes('skoop-continue-sync')) {
            const version = ext.packageJSON?.version || '0.0.0';
            console.log('[Skoop Continue Sync] ✅ Found extension with partial match ID:', ext.id);
            console.log('[Skoop Continue Sync] Current extension version:', version);
            console.log('[Skoop Continue Sync] Extension path:', ext.extensionPath);
            return version;
        }
    }

    console.log('[Skoop Continue Sync] ❌ Extension not found with any pattern');
    console.log('[Skoop Continue Sync] All extensions with "skoop" in ID:', allExtensions.filter(ext => ext.id.includes('skoop')).map(ext => ({ id: ext.id, version: ext.packageJSON?.version })));
    return '0.0.0';
}

// Compare version strings (simple semver comparison)
function compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);

    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
        const v1Part = v1Parts[i] || 0;
        const v2Part = v2Parts[i] || 0;

        if (v1Part > v2Part) return 1;
        if (v1Part < v2Part) return -1;
    }

    return 0;
}

// Check and notify about updates
async function checkAndNotifyUpdates() {
    if (!extensionContext) {
        log('Extension context not available, skipping update check', true);
        return;
    }

    // Check if auto-updates are enabled
    const enableAutoUpdates = vscode.workspace.getConfiguration('skoop-continue-sync').get('enableAutoUpdates', true);
    if (!enableAutoUpdates) {
        log('Auto-updates disabled, skipping update check', true);
        return;
    }

    const now = Date.now();
    const refreshInterval = vscode.workspace.getConfiguration('skoop-continue-sync').get('refreshInterval', 10) * 1000;

    if (now - lastUpdateCheck > refreshInterval) {
        log('Checking for extension updates...', true);

        try {
            const updateInfo = await checkForUpdates();
            lastUpdateCheck = now;

            if (updateInfo) {
                const currentVersion = getCurrentVersion();
                const comparison = compareVersions(updateInfo.version, currentVersion);

                if (comparison > 0) {
                    // Check if this version was previously ignored
                    const ignoredVersion = extensionContext.globalState.get('ignoredVersion');
                    if (ignoredVersion === updateInfo.version) {
                        log(`Version ${updateInfo.version} was previously ignored`, true);
                        return;
                    }

                    // New version available
                    latestVersion = updateInfo.version;
                    updateAvailable = true;

                    log(`New version available: ${updateInfo.version} (current: ${currentVersion})`, true);

                    // Show notification
                    const updateNow = 'Update Now';
                    const remindLater = 'Remind Later';
                    const ignore = 'Ignore';

                    const choice = await vscode.window.showInformationMessage(
                        `A new version of Skoop Continue Sync is available (v${updateInfo.version}). Current version: v${currentVersion}`,
                        updateNow,
                        remindLater,
                        ignore
                    );

                    if (choice === updateNow) {
                        await installUpdate(updateInfo.downloadUrl, updateInfo.version);
                    } else if (choice === remindLater) {
                        // Will check again on next interval
                        log('User chose to be reminded later', true);
                    } else if (choice === ignore) {
                        // Don't show again for this version
                        await extensionContext.globalState.update('ignoredVersion', updateInfo.version);
                        updateAvailable = false;
                        log(`User ignored version ${updateInfo.version}`, true);
                    }
                } else if (comparison === 0) {
                    log('Extension is up to date', true);
                    updateAvailable = false;
                } else {
                    log('Current version is newer than latest release', true);
                }
            } else {
                log('No update information available', true);
            }

            // Save update check time
            await extensionContext.globalState.update('lastUpdateCheck', lastUpdateCheck);
        } catch (error) {
            console.error('[Skoop Continue Sync] Update check failed:', error);
        }
    } else {
        log(`Update check still fresh (${Math.round((refreshInterval - (now - lastUpdateCheck)) / 1000)}s remaining)`, true);
    }
}

// Install extension update
async function installUpdate(downloadUrl: string, version: string) {
    try {
        log(`Guiding user to install extension update to version ${version}...`, true);

        // For manually installed extensions, guide user to download from GitHub
        const downloadNow = 'Download Now';
        const openReleases = 'Open Releases Page';
        const cancel = 'Cancel';

        const choice = await vscode.window.showInformationMessage(
            `A new version (v${version}) is available! Since this extension is manually installed, you'll need to download and install the update manually.`,
            downloadNow,
            openReleases,
            cancel
        );

        if (choice === downloadNow) {
            // Try to open the download URL directly
            try {
                await vscode.env.openExternal(vscode.Uri.parse(downloadUrl));
                vscode.window.showInformationMessage(
                    `Downloading v${version}... After download completes, run "Extensions: Install from VSIX..." from the command palette and select the downloaded file.`
                );
            } catch (error) {
                console.error('[Skoop Continue Sync] Failed to open download URL:', error);
                vscode.window.showErrorMessage(`Failed to open download. Please visit: ${downloadUrl}`);
            }
        } else if (choice === openReleases) {
            // Open the releases page
            const releasesUrl = 'https://github.com/SKOOP-Digital/skoop-continue-sync/releases';
            await vscode.env.openExternal(vscode.Uri.parse(releasesUrl));
            vscode.window.showInformationMessage(
                `Download the latest .vsix file and install it using "Extensions: Install from VSIX..."`
            );
        }

        log('Guided user to manual update installation', true);

    } catch (error) {
        console.error('[Skoop Continue Sync] Failed to guide user to update:', error);
        vscode.window.showErrorMessage(`Failed to start update process: ${error}`);
    }
}

// Manual update check (for settings UI)
async function manualUpdateCheck() {
    log('Manual update check triggered', true);

    try {
        const updateInfo = await checkForUpdates();

        if (updateInfo) {
            const currentVersion = getCurrentVersion();
            const comparison = compareVersions(updateInfo.version, currentVersion);

            if (comparison > 0) {
                const install = 'Install Update';
                const choice = await vscode.window.showInformationMessage(
                    `New version available: v${updateInfo.version} (current: v${currentVersion})`,
                    install
                );

                if (choice === install) {
                    await installUpdate(updateInfo.downloadUrl, updateInfo.version);
                }
            } else {
                vscode.window.showInformationMessage('Your extension is up to date!');
            }
        } else {
            vscode.window.showWarningMessage('Could not check for updates. Please try again later.');
        }
    } catch (error) {
        console.error('[Skoop Continue Sync] Manual update check failed:', error);
        vscode.window.showErrorMessage(`Update check failed: ${error}`);
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

