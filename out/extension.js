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
const https = __importStar(require("https"));
// Global state for automatic refresh
let lastConfigRefresh = 0;
let refreshTimer = null;
let isOnline = true;
function activate(context) {
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
        }
        catch (error) {
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
        }
        catch (error) {
            console.error('[Skoop Continue Sync] Error clearing configs:', error);
            vscode.window.showErrorMessage(`Failed to clear configurations: ${error}`);
        }
    });
    context.subscriptions.push(applySettingsDisposable, clearConfigDisposable);
    console.log('[Skoop Continue Sync] Commands registered: skoop-continue-sync.applyTeamSettings, skoop-continue-sync.clearAllConfigs');
}
exports.activate = activate;
// Fetch configuration from HTTP endpoint
async function fetchTeamConfig() {
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
                    let configData;
                    // Try to parse as JSON first (expected format)
                    try {
                        const response = JSON.parse(data);
                        if (Array.isArray(response) && response.length > 0 && response[0].data) {
                            configData = response[0].data;
                            console.log('[Skoop Continue Sync] Parsed JSON response, extracted data field');
                        }
                        else {
                            throw new Error('Invalid JSON response format');
                        }
                    }
                    catch (jsonError) {
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
                }
                catch (error) {
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
function processRawYamlConfig(yamlContent) {
    const config = {
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
            let currentSetting = null;
            for (const line of settingsLines) {
                if (line.startsWith('  - name:')) {
                    if (currentSetting) {
                        config.settings.push(currentSetting);
                    }
                    const name = line.match(/name:\s*"([^"]+)"/)?.[1] || '';
                    currentSetting = { name };
                }
                else if (currentSetting && line.includes(':')) {
                    const [key, ...valueParts] = line.trim().split(':');
                    const value = valueParts.join(':').trim();
                    if (value.startsWith('"') && value.endsWith('"')) {
                        currentSetting[key.trim()] = value.slice(1, -1);
                    }
                    else {
                        currentSetting[key.trim()] = value;
                    }
                }
                else if (currentSetting && currentSetting.name === 'continueignore' && line.trim() && !line.includes(':') && !line.startsWith('  -')) {
                    // Handle direct values for continueignore (patterns without keys)
                    const pattern = line.trim();
                    if (!currentSetting.patterns) {
                        currentSetting.patterns = [];
                    }
                    currentSetting.patterns.push(pattern);
                }
            }
            if (currentSetting) {
                config.settings.push(currentSetting);
            }
        }
        // Extract individual agent configurations
        const agentsMatch = yamlContent.match(/Agents:\s*\n(.*)/s);
        if (agentsMatch) {
            const agentsSection = agentsMatch[1];
            // Split by agent definitions (look for lines starting with "  - agent:")
            const agentBlocks = agentsSection.split(/(?=^\s*-\s*agent:)/m);
            for (const agentBlock of agentBlocks) {
                if (!agentBlock.trim())
                    continue;
                const agent = {
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
                    }
                    else if (line.includes('version:')) {
                        agent.version = line.match(/version:\s*"([^"]+)"/)?.[1] || '';
                    }
                    else if (line.includes('schema:')) {
                        agent.schema = line.match(/schema:\s*"([^"]+)"/)?.[1] || '';
                    }
                    else if (line.includes('description:')) {
                        agent.description = line.match(/description:\s*"([^"]+)"/)?.[1] || '';
                    }
                }
                if (agent.agent) {
                    config.Agents.push(agent);
                }
            }
        }
        console.log('[Skoop Continue Sync] Processed config structure:', {
            settingsCount: config.settings?.length || 0,
            agentsCount: config.Agents?.length || 0
        });
    }
    catch (error) {
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
    let teamConfig;
    try {
        teamConfig = await fetchTeamConfig();
        console.log('[Skoop Continue Sync] Team configuration fetched successfully');
    }
    catch (error) {
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
    }
    catch (error) {
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
    }
    catch (error) {
        console.error('[Skoop Continue Sync] Error writing config:', error);
        throw error;
    }
}
async function findContinueConfigPath() {
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
        }
        catch (error) {
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
        'chromium',
        'chromium-browser',
        'google-chrome',
        'chrome',
        path.join(os.homedir(), '.continue', '.utils', 'chromium', 'chrome'),
        path.join(os.homedir(), '.continue', '.utils', 'chromium', 'chromium'),
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        'C:\\Program Files\\Chromium\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Chromium\\Application\\chrome.exe', // Windows x86
    ];
    for (const chromiumPath of possiblePaths) {
        try {
            console.log(`[Skoop Continue Sync] Checking Chromium at: ${chromiumPath}`);
            const { spawn } = require('child_process');
            const chromiumCheck = spawn(chromiumPath, ['--version'], { stdio: 'pipe' });
            const result = await new Promise((resolve) => {
                chromiumCheck.on('close', (code) => {
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
        }
        catch (error) {
            // Continue to next path
        }
    }
    console.log('[Skoop Continue Sync] Chromium not found in common locations, will be downloaded by Continue.dev');
    console.log('[Skoop Continue Sync] Continue.dev typically installs Chromium to: ~/.continue/.utils/chromium/');
    return false;
}
// Configure VS Code Continue.dev extension settings from config
async function configureContinueSettingsFromConfig(settings) {
    console.log('[Skoop Continue Sync] Configuring VS Code Continue.dev extension settings from config...');
    try {
        for (const setting of settings) {
            // Handle VSCodeSettings section
            if (setting.name === 'VSCodeSettings') {
                for (const [settingKey, desiredValue] of Object.entries(setting)) {
                    if (settingKey === 'name')
                        continue; // Skip the name field
                    // Parse the setting key (e.g., "continue.enableConsole" -> ["continue", "enableConsole"])
                    const [extensionId, settingName] = settingKey.split('.', 2);
                    if (extensionId && settingName) {
                        const config = vscode.workspace.getConfiguration(extensionId);
                        const currentValue = config.get(settingName);
                        console.log(`[Skoop Continue Sync] Checking ${settingKey}: current=${currentValue}, desired=${desiredValue}`);
                        if (currentValue !== desiredValue) {
                            await config.update(settingName, desiredValue, vscode.ConfigurationTarget.Global);
                            console.log(`[Skoop Continue Sync] Set ${settingKey} to ${desiredValue}`);
                        }
                        else {
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
                const ignorePatterns = [];
                // Check if patterns were parsed as an array
                if (setting.patterns && Array.isArray(setting.patterns)) {
                    ignorePatterns.push(...setting.patterns);
                }
                // Also check for any direct string values (fallback for other formats)
                for (const [key, value] of Object.entries(setting)) {
                    if (key === 'name' || key === 'patterns')
                        continue; // Skip the name field and patterns array
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
                }
                else {
                    console.log('[Skoop Continue Sync] No ignore patterns found in continueignore setting');
                }
            }
        }
        console.log('[Skoop Continue Sync] Continue.dev extension settings configured successfully');
    }
    catch (error) {
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
function setupConfigurationListeners(context) {
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
                }
                catch (error) {
                    console.error('[Skoop Continue Sync] Error executing apply command:', error);
                }
                // Reset the trigger back to false
                try {
                    await vscode.workspace.getConfiguration('skoop-continue-sync').update('applyConfig', false, vscode.ConfigurationTarget.Global);
                }
                catch (resetError) {
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
                }
                catch (error) {
                    console.error('[Skoop Continue Sync] Error executing clear command:', error);
                }
                // Reset the trigger back to false
                try {
                    await vscode.workspace.getConfiguration('skoop-continue-sync').update('clearConfig', false, vscode.ConfigurationTarget.Global);
                }
                catch (resetError) {
                    console.error('[Skoop Continue Sync] Error resetting clearConfig setting:', resetError);
                }
            }
        }
    });
    context.subscriptions.push(onDidChangeConfiguration);
}
// Setup automatic config refresh
function setupAutomaticRefresh(context) {
    console.log('[Skoop Continue Sync] Setting up automatic config refresh...');
    // Store context globally for use in automatic refresh
    extensionContext = context;
    // Load last refresh time from global state
    lastConfigRefresh = context.globalState.get('lastConfigRefresh', 0);
    console.log('[Skoop Continue Sync] Last config refresh:', new Date(lastConfigRefresh).toISOString());
    // Check if we need to refresh on startup
    checkAndRefreshConfig();
    // Set up periodic refresh (every 10 seconds for testing)
    refreshTimer = setInterval(() => {
        console.log('[Skoop Continue Sync] Periodic config refresh check...');
        checkAndRefreshConfig();
    }, 10 * 1000); // 10 seconds for testing
    // Listen for when VS Code becomes active again (user comes back online)
    const onDidChangeWindowState = vscode.window.onDidChangeWindowState((state) => {
        if (state.focused && !isOnline) {
            console.log('[Skoop Continue Sync] VS Code regained focus, checking for config refresh...');
            isOnline = true;
            checkAndRefreshConfig();
        }
        else if (!state.focused) {
            isOnline = false;
        }
    });
    context.subscriptions.push({ dispose: () => onDidChangeWindowState.dispose() });
}
// Global reference to extension context for state management
let extensionContext = null;
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
    const tenSeconds = 10 * 1000; // 10 seconds for testing
    if (now - lastConfigRefresh > tenSeconds) {
        console.log('[Skoop Continue Sync] More than 10 seconds since last refresh, refreshing config...');
        try {
            await applyTeamSettings();
            lastConfigRefresh = now;
            // Save to global state
            await extensionContext.globalState.update('lastConfigRefresh', lastConfigRefresh);
            console.log('[Skoop Continue Sync] Automatic config refresh completed');
        }
        catch (error) {
            console.error('[Skoop Continue Sync] Automatic config refresh failed:', error);
        }
    }
    else {
        console.log('[Skoop Continue Sync] Config is still fresh (less than 10 seconds old), skipping automatic refresh');
    }
}
function deactivate() {
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
    }
}
exports.deactivate = deactivate;
// Install agent files from raw YAML config
async function installAgentFilesFromRawConfig(configPath, rawYaml, agents) {
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
        }
        catch (error) {
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
                }
                catch (error) {
                    console.warn(`[Skoop Continue Sync] Could not create agent file ${fileName}:`, error);
                }
            }
            else {
                console.warn(`[Skoop Continue Sync] Could not extract YAML for agent: ${agent.agent}`);
            }
        }
    }
    console.log(`[Skoop Continue Sync] Installed ${agents.length - 1} agent files in ${targetAgentsDir}`);
}
// Extract agent YAML from the full configuration
function extractAgentYaml(fullYaml, agentName) {
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
        }
        else if (line.startsWith('  ')) {
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
function forceDocsRetryForRawYaml(rawYaml) {
    console.log('[Skoop Continue Sync] Forcing docs retry by updating agent YAML configuration...');
    // Add a timestamp to force re-indexing of docs in the agent YAML
    const retryTimestamp = Date.now();
    const updatedYaml = rawYaml.replace(/(startUrl:\s*)(https?:\/\/[^&\n]*)/g, (match, prefix, url) => {
        const separator = url.includes('?') ? '&' : '?';
        return `${prefix}${url}${separator}retry=${retryTimestamp}`;
    });
    // Update the raw YAML if any URLs were modified
    if (updatedYaml !== rawYaml) {
        console.log('[Skoop Continue Sync] Updated docs URLs to force retry');
        // Note: This function modifies the rawYaml by reference, but since it's passed by value,
        // we'd need to return it or modify the calling code. For now, we'll just log.
    }
}
//# sourceMappingURL=extension.js.map