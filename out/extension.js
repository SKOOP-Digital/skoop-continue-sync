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
    let config = {};
    // Initialize with clean config - start simple with just models first
    console.log('[Skoop Continue Sync] Initializing with clean team configuration');
    config = {
        name: "Skoop Team Config",
        version: "1.0.0",
        schema: "v1",
        experimental: {
            useChromiumForDocsCrawling: true
        },
        models: [],
        agents: [],
        rules: [],
        prompts: [],
        docs: []
    };
    console.log('[Skoop Continue Sync] Initialized clean config');
    // Apply team settings - start with just models to isolate issues
    // Ensure Chromium is available for docs crawling
    console.log('[Skoop Continue Sync] Checking Chromium availability...');
    await ensureChromiumAvailable();
    console.log('[Skoop Continue Sync] Applying LiteLLM settings...');
    config = applyLiteLLMSettings(config);
    console.log('[Skoop Continue Sync] Applying model settings...');
    config = applyModelSettings(config);
    // Add agents, rules, and prompts with correct format
    console.log('[Skoop Continue Sync] Applying agent settings...');
    config = applyAgentSettings(config);
    console.log('[Skoop Continue Sync] Applying rules and prompts...');
    config = applyRulesAndPrompts(config);
    // Add docs to main config for better integration
    console.log('[Skoop Continue Sync] Adding docs to main config...');
    config.docs = [{
            name: "Skoop Documentation",
            startUrl: "https://www.skoopsignage.com/",
            favicon: "https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.skoopsignage.com/&size=16"
        }];
    console.log('[Skoop Continue Sync] Adding sample docs, MCP tools, and data...');
    await addSampleDocs(configPath);
    await addSampleMcpTools(configPath);
    await addSampleData(configPath);
    // Force retry docs indexing to clear any previous failures
    console.log('[Skoop Continue Sync] Forcing docs retry...');
    forceDocsRetry(config);
    // Write updated config
    console.log('[Skoop Continue Sync] Writing updated config...');
    try {
        const yamlContent = configToYaml(config);
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
// Ensure Chromium is available for docs crawling
async function ensureChromiumAvailable() {
    console.log('[Skoop Continue Sync] Ensuring Chromium is available for docs crawling...');
    const os = require('os');
    const path = require('path');
    const fs = require('fs');
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
// Force retry docs indexing by updating timestamp
function forceDocsRetry(config) {
    console.log('[Skoop Continue Sync] Forcing docs retry by updating configuration...');
    // Add a timestamp to force re-indexing
    if (config.docs && Array.isArray(config.docs) && config.docs.length > 0) {
        config.docs.forEach((doc) => {
            if (doc.startUrl) {
                // Add a cache-busting parameter
                const separator = doc.startUrl.includes('?') ? '&' : '?';
                doc.startUrl = `${doc.startUrl}${separator}retry=${Date.now()}`;
                console.log(`[Skoop Continue Sync] Updated docs URL to force retry: ${doc.startUrl}`);
            }
        });
    }
}
function applyLiteLLMSettings(config) {
    console.log('[Skoop Continue Sync] Reading VS Code configuration...');
    const litellmUrl = vscode.workspace.getConfiguration('skoop-continue-sync').get('litellmUrl', 'https://litellm.skoop.digital/');
    const litellmApiKey = vscode.workspace.getConfiguration('skoop-continue-sync').get('litellmApiKey', 'sk-Phkcy9C76yAAc2rNAAsnlg');
    console.log('[Skoop Continue Sync] LiteLLM URL:', litellmUrl);
    console.log('[Skoop Continue Sync] LiteLLM API Key length:', litellmApiKey.length);
    // Models array is already initialized as empty array
    console.log('[Skoop Continue Sync] Models array initialized:', config.models.length);
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
    // Add specific models from LiteLLM - use only basic OpenAI models that Continue.dev definitely supports
    const teamModels = [
        {
            provider: 'openai',
            model: 'gpt-4',
            apiBase: litellmUrl,
            apiKey: litellmApiKey,
            title: 'GPT-4 (Team)',
            roles: ['chat', 'edit']
        },
        {
            provider: 'openai',
            model: 'gpt-3.5-turbo',
            apiBase: litellmUrl,
            apiKey: litellmApiKey,
            title: 'GPT-3.5 Turbo (Team)',
            roles: ['chat', 'autocomplete']
        }
    ];
    console.log('[Skoop Continue Sync] Adding team models...');
    // Clear existing models and add fresh ones to avoid conflicts
    console.log('[Skoop Continue Sync] Clearing existing models to avoid conflicts...');
    config.models.length = 0; // Clear the array
    // Add all team models fresh
    for (const teamModel of teamModels) {
        console.log(`[Skoop Continue Sync]   Adding: ${teamModel.title}`);
        config.models.push(teamModel);
    }
    console.log('[Skoop Continue Sync] Final models count:', config.models.length);
    return config;
}
function applyModelSettings(config) {
    console.log('[Skoop Continue Sync] Setting default models...');
    console.log('[Skoop Continue Sync] Models before setting defaults:', config.models.length);
    // Note: Continue.dev handles default model selection through its UI
    // We don't need to set isDefault in the configuration
    return config;
}
function applyAgentSettings(config) {
    console.log('[Skoop Continue Sync] Applying agent settings...');
    console.log('[Skoop Continue Sync] Existing agents count:', config.agents.length);
    const teamAgents = [
        {
            name: 'CodeReviewer',
            description: 'Agent for code review tasks',
            model: 'gpt-4',
            tools: ['read_file', 'run_terminal_cmd'],
            prompt: 'You are a senior developer reviewing code for quality, security, and best practices.'
        },
        {
            name: 'BugFixer',
            description: 'Agent for debugging and fixing issues',
            model: 'gpt-3.5-turbo',
            tools: ['read_file', 'grep', 'run_terminal_cmd'],
            prompt: 'You are an expert debugger. Analyze code, find bugs, and provide fixes with explanations.'
        },
        {
            name: 'DocumentationWriter',
            description: 'Agent for writing and updating documentation',
            model: 'gpt-4',
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
// Simple YAML serializer for basic structures
function configToYaml(config) {
    let yaml = '';
    // Add basic fields
    if (config.name)
        yaml += `name: "${config.name}"\n`;
    if (config.version)
        yaml += `version: "${config.version}"\n`;
    if (config.schema)
        yaml += `schema: "${config.schema}"\n`;
    // Add models - match Continue.dev's expected format
    if (config.models && config.models.length > 0) {
        yaml += '\nmodels:\n';
        for (const model of config.models) {
            yaml += '  - name: "' + (model.title || model.model) + '"\n';
            yaml += '    provider: ' + model.provider + '\n';
            yaml += '    model: ' + model.model + '\n';
            if (model.apiKey)
                yaml += '    apiKey: "' + model.apiKey + '"\n';
            if (model.apiBase)
                yaml += '    apiBase: ' + model.apiBase + '\n';
            if (model.roles && model.roles.length > 0) {
                yaml += '    roles:\n';
                for (const role of model.roles) {
                    yaml += '      - ' + role + '\n';
                }
            }
        }
    }
    // Add agents
    if (config.agents && config.agents.length > 0) {
        yaml += '\nagents:\n';
        for (const agent of config.agents) {
            yaml += '  - name: "' + agent.name + '"\n';
            if (agent.description)
                yaml += '    description: "' + agent.description + '"\n';
            yaml += '    model: ' + agent.model + '\n';
            if (agent.tools && agent.tools.length > 0) {
                yaml += '    tools:\n';
                for (const tool of agent.tools) {
                    yaml += '      - ' + tool + '\n';
                }
            }
            if (agent.prompt)
                yaml += '    prompt: "' + agent.prompt.replace(/"/g, '\\"') + '"\n';
        }
    }
    // Add rules
    if (config.rules && config.rules.length > 0) {
        yaml += '\nrules:\n';
        for (const rule of config.rules) {
            yaml += '  - name: "' + rule.name + '"\n';
            if (rule.description)
                yaml += '    description: "' + rule.description + '"\n';
            yaml += '    rule: "' + rule.rule.replace(/"/g, '\\"') + '"\n';
        }
    }
    // Add prompts
    if (config.prompts && config.prompts.length > 0) {
        yaml += '\nprompts:\n';
        for (const prompt of config.prompts) {
            yaml += '  - name: "' + prompt.name + '"\n';
            if (prompt.description)
                yaml += '    description: "' + prompt.description + '"\n';
            yaml += '    prompt: "' + prompt.prompt.replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"\n';
        }
    }
    return yaml;
}
// Add sample documentation configuration
async function addSampleDocs(configPath) {
    console.log('[Skoop Continue Sync] Adding sample documentation...');
    const docsDir = path.dirname(configPath);
    const docsConfigDir = path.join(docsDir, 'docs');
    if (!fs.existsSync(docsConfigDir)) {
        fs.mkdirSync(docsConfigDir, { recursive: true });
    }
    // Create a docs block configuration
    const docsYaml = `name: "Skoop Team Documentation"
version: "1.0.0"
schema: "v1"
docs:
  - name: "Skoop Documentation -2"
    startUrl: https://www.skoopsignage.com/industry/sports-entertainment
    favicon: https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.skoopsignage.com/&size=16
`;
    const docsConfigPath = path.join(docsConfigDir, 'skoop-docs.yaml');
    fs.writeFileSync(docsConfigPath, docsYaml, 'utf8');
    console.log(`[Skoop Continue Sync] Created docs config: ${docsConfigPath}`);
}
// Add sample MCP tools configuration
async function addSampleMcpTools(configPath) {
    console.log('[Skoop Continue Sync] Adding sample MCP tools...');
    const mcpDir = path.dirname(configPath);
    const mcpConfigDir = path.join(mcpDir, 'mcpServers');
    if (!fs.existsSync(mcpConfigDir)) {
        fs.mkdirSync(mcpConfigDir, { recursive: true });
    }
    // Clean up any old MCP configuration files
    console.log('[Skoop Continue Sync] Cleaning up old MCP configurations...');
    const oldMcpFiles = [
        'database-mcp.yaml',
        'url-mcp-demo.yaml',
        'mcp-demo.yaml'
    ];
    for (const oldFile of oldMcpFiles) {
        const oldPath = path.join(mcpConfigDir, oldFile);
        if (fs.existsSync(oldPath)) {
            try {
                fs.unlinkSync(oldPath);
                console.log(`[Skoop Continue Sync] Removed old MCP config: ${oldFile}`);
            }
            catch (error) {
                console.warn(`[Skoop Continue Sync] Could not remove old MCP config ${oldFile}:`, error);
            }
        }
    }
    // Create a simple MCP server block configuration
    const mcpYaml = `name: "Skoop MCP Demo"
version: "1.0.0"
schema: "v1"
mcpServers:
  - name: "Simple Demo Server"
    command: node
    args:
      - -e
      - |
        // Simple MCP server that responds to basic requests
        const readline = require('readline');

        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
          terminal: false
        });

        // Send initialize response
        console.log(JSON.stringify({
          jsonrpc: "2.0",
          id: 0,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: {
                listChanged: true
              }
            },
            serverInfo: {
              name: "simple-demo",
              version: "1.0.0"
            }
          }
        }));

        rl.on('line', (line) => {
          try {
            const request = JSON.parse(line.trim());

            if (request.method === 'tools/list') {
              // Respond to tools/list
              console.log(JSON.stringify({
                jsonrpc: "2.0",
                id: request.id,
                result: {
                  tools: [{
                    name: "demo_echo",
                    description: "Echo back a message",
                    inputSchema: {
                      type: "object",
                      properties: {
                        text: {
                          type: "string",
                          description: "Text to echo"
                        }
                      },
                      required: ["text"]
                    }
                  }]
                }
              }));
            } else if (request.method === 'tools/call' && request.params.name === 'demo_echo') {
              // Respond to tools/call
              console.log(JSON.stringify({
                jsonrpc: "2.0",
                id: request.id,
                result: {
                  content: [{
                    type: "text",
                    text: "Echo from Skoop Demo: " + request.params.arguments.text
                  }]
                }
              }));
            } else if (request.method === 'resources/list' || request.method === 'resources/templates/list') {
              // Handle resources requests (optional)
              console.log(JSON.stringify({
                jsonrpc: "2.0",
                id: request.id,
                result: []
              }));
            }
          } catch (e) {
            // Send error response
            console.log(JSON.stringify({
              jsonrpc: "2.0",
              id: null,
              error: {
                code: -32700,
                message: "Parse error: " + e.message
              }
            }));
          }
        });

        process.on('SIGINT', () => {
          rl.close();
          process.exit(0);
        });
    env: {}
`;
    const mcpConfigPath = path.join(mcpConfigDir, 'skoop-mcp-demo.yaml');
    fs.writeFileSync(mcpConfigPath, mcpYaml, 'utf8');
    console.log(`[Skoop Continue Sync] Created MCP config: ${mcpConfigPath}`);
    console.log(`[Skoop Continue Sync] MCP server will provide: demo_echo tool`);
    console.log(`[Skoop Continue Sync] Note: MCP server may take a few seconds to initialize`);
}
// Add sample data configuration
async function addSampleData(configPath) {
    console.log('[Skoop Continue Sync] Adding sample data configuration...');
    const dataDir = path.dirname(configPath);
    const dataConfigDir = path.join(dataDir, 'data');
    if (!fs.existsSync(dataConfigDir)) {
        fs.mkdirSync(dataConfigDir, { recursive: true });
    }
    // Create a data block configuration
    const dataYaml = `name: "Skoop Team Analytics"
version: "1.0.0"
schema: "v1"
data:
  - name: "Team Usage Analytics"
    destination: file:///${process.env.USERPROFILE || process.env.HOME}/.continue/analytics.jsonl
    schema: "0.2.0"
    level: "all"
    events:
      - autocomplete
      - chatInteraction
      - agentAction
`;
    const dataConfigPath = path.join(dataConfigDir, 'analytics.yaml');
    fs.writeFileSync(dataConfigPath, dataYaml, 'utf8');
    console.log(`[Skoop Continue Sync] Created data config: ${dataConfigPath}`);
}
//# sourceMappingURL=extension.js.map