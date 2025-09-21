# Skoop Continue Sync

A VS Code extension that synchronizes Continue.dev settings for team members, allowing centralized management of models, agents, rules, and prompts.

## Features

- **External Configuration**: All settings loaded from `team-config.json` file
- **LiteLLM Integration**: Automatically configures models from your LiteLLM server
- **Team Model Management**: Sets up standardized models with role-based assignments
- **Agent Configuration**: Deploys predefined agents for common development tasks
- **Global Rules**: Applies team-wide coding standards and best practices
- **Custom Prompts**: Provides standardized prompts for code review and bug analysis
- **Documentation Setup**: Configures team documentation sources in main config
- **Future MCP Support**: Ready for Model Context Protocol servers
- **Future Analytics**: Ready for data collection and team insights

## Configuration

### Packaged Configuration Files

The extension includes comprehensive configuration files demonstrating Continue.dev best practices:

#### **team-config.json** - Main Configuration
Contains team-specific settings with LiteLLM models and local customizations.

#### **pr-mode.md** - Markdown Prompt Example
Demonstrates Continue.dev's markdown prompt format with frontmatter metadata.

#### **Features Demonstrated**
- **Hub Block References**: Using `uses:` to reference pre-built configurations from Continue Hub
- **Mixed Configurations**: Combining hub blocks (`starter/java-rules`) with local custom rules
- **LiteLLM Integration**: All models configured through team's LiteLLM server
- **Agent Architecture**: Agents using only LiteLLM models with specific role assignments
- **Standard Schemas**: Following Continue.dev's official configuration standards

### Customizing Configuration

**For Team Administrators:**
1. Download and install the extension
2. Locate the installed extension directory (usually `~/.vscode/extensions/*/skoop-continue-sync-*/`)
3. Edit the `team-config.json` file with your team's settings
4. Restart VS Code to apply changes

**For Individual Developers:**
- The extension will use the packaged default configuration
- Team administrators can provide updated `team-config.json` files for team members to use

### VS Code Settings (Optional)

The extension also supports VS Code configuration overrides:

- `skoop-continue-sync.litellmUrl`: Override the LiteLLM server URL from `team-config.json`
- `skoop-continue-sync.litellmApiKey`: Override the LiteLLM API key from `team-config.json`

## Usage

1. Install the extension (includes default `team-config.json`)
2. **Optional:** Customize `team-config.json` in the extension directory for team-specific settings
3. **Optional:** Override LiteLLM credentials in VS Code settings
4. Run the "Apply Team Continue Settings" command from the Command Palette
5. The extension loads configuration and applies settings to Continue.dev

## Team Configuration

The extension loads all team settings from `team-config.json`. By default, it configures:

- **GPT-4 (Team)**: For chat, edit, and apply operations
- **GPT-3.5 Turbo (Team)**: For chat, autocomplete, and summarize operations (prioritized for autocomplete)

### Generated Configuration Example

The extension generates a `config.yaml` file like this:

```yaml
name: "Skoop Team Config"
version: "1.0.0"
schema: "v1"
experimental:
  useChromiumForDocsCrawling: true

models:
  - name: "GPT-4 (Team)"
    provider: openai
    model: gpt-4
    apiBase: https://litellm.skoop.digital/
    apiKey: "sk-Phkcy9C76yAAc2rNAAsnlg"
    roles:
      - chat
      - edit
      - apply
    defaultCompletionOptions:
      contextLength: 128000
      maxTokens: 4096

rules:
  - uses: starter/java-rules
  - name: "Team CodeStyle"
    description: "Enforce team coding standards"
    rule: "Always use TypeScript with strict type checking..."

prompts:
  - uses: starter/test-prompt
  - name: "CodeReview"
    description: "Standard code review prompt"
    prompt: "Please review this code for:..."
```

## Team Agents

- **CodeReviewer**: Reviews code for quality, security, and best practices
- **BugFixer**: Analyzes bugs and provides fixes with explanations
- **DocumentationWriter**: Creates comprehensive documentation

## Team Rules

- **CodeStyle**: Enforces TypeScript standards and ESLint compliance
- **Security**: Implements security best practices and input validation
- **Documentation**: Requires JSDoc comments and README updates

## Sample Configurations

The extension also creates sample configurations for:

### Documentation (`.continue/docs/`)
- **Skoop Team Documentation**: Configures documentation crawling from your team docs site

### MCP Tools (`.continue/mcpServers/`)
- **Skoop Database MCP**: SQLite database integration for team data access

### Analytics & Data (`.continue/data/`)
- **Skoop Team Analytics**: Data collection for team insights and usage tracking

## 📁 **Generated Sample Configurations**

The extension creates sample block files in separate directories:

**📚 Sample Docs Configuration:**
```yaml
# .continue/docs/skoop-docs.yaml
name: "Skoop Team Documentation"
version: "1.0.0"
schema: "v1"
docs:
  - name: "Skoop Documentation"
    startUrl: https://docs.skoop.digital/
    favicon: https://docs.skoop.digital/favicon.ico
```

**🔌 Sample MCP Configuration:**
```yaml
# .continue/mcpServers/skoop-mcp-demo.yaml
name: "Skoop MCP Demo"
version: "1.0.0"
schema: "v1"
mcpServers:
  - name: "Simple Demo Server"
    command: node
    args: ["-e", "/* Simple inline MCP server with demo_echo tool */"]
    env: {}
```

**Available MCP Tools:**
- ✅ **`demo_echo`**: Echo back a message you provide
- ✅ **Full MCP Protocol Support**: tools/list, tools/call, error handling
- ✅ **No External Dependencies**: Uses only Node.js built-in modules

**📊 Sample Data Configuration:**
```yaml
# .continue/data/analytics.yaml
name: "Skoop Team Analytics"
version: "1.0.0"
schema: "v1"
data:
  - name: "Team Usage Analytics"
    destination: file:///%USERPROFILE%/.continue/analytics
    schema: "0.2.0"
    level: "noCode"
    events:
      - autocomplete
      - chatInteraction
      - agentAction
    apiKey: "skoop-analytics-key"
```

## 🆕 **New Features**

### **Model Role & Performance Configuration**
The extension now provides detailed control over:
- ✅ **Model Roles Assignment**: Specify which models handle `chat`, `edit`, `autocomplete`, etc.
- ✅ **Performance Settings**: Configure context length, token limits, temperature, and more
- ✅ **Autocomplete Optimization**: Fine-tune context size, debounce delay, caching
- ✅ **Multi-Model Support**: Different models for different roles with prioritized selection

### **VS Code Extension Settings Integration**
- ✅ **Automatic Configuration** of Continue.dev VS Code extension settings
- ✅ **Enables Console Logging** (`continue.enableConsole`)
- ✅ **Optimizes Performance** with recommended settings
- ✅ **Configures Tab Autocomplete** and other productivity features

### **Advanced Agent Management**
- ✅ **Multiple Agents**: CodeReviewer, BugFixer, DocumentationWriter, CodeAssistant
- ✅ **Role-Specific Models**: Each agent uses the most appropriate model
- ✅ **Custom Tools**: Tailored tool sets for different agent purposes
- ✅ **Specialized Prompts**: Context-aware system prompts per agent

### **Chromium Auto-Detection & Installation**
The extension automatically:
- ✅ **Checks for Chromium availability** before running
- ✅ **Enables `useChromiumForDocsCrawling`** in the config
- ✅ **Forces retry** of failed documentation crawls
- ✅ **Logs detailed status** of Chromium availability

### **Force Retry Mechanism**
- ✅ **Clears cached failures** by adding timestamp parameters
- ✅ **Forces re-indexing** of documentation sites
- ✅ **Handles JavaScript-heavy sites** like https://www.skoopsignage.com/

### **Updated Documentation Site**
- ✅ **Uses https://www.skoopsignage.com/** as the primary docs site
- ✅ **Automatic favicon detection** and configuration
- ✅ **Chromium-based crawling** for JavaScript content
- ✅ **Force retry mechanism** to clear cached failures
- ✅ **Enhanced Chromium detection** with multiple path checking

### **Documentation Scraping Details**
- ✅ **JavaScript-heavy sites supported** via Chromium
- ✅ **Automatic retry** with timestamp cache-busting
- ✅ **Comprehensive logging** of scraping process
- ✅ **Fallback to standard crawling** if Chromium unavailable

## ⚙️ **Model Configuration Guide**

### **How Model Roles Work**
Each model can be assigned multiple roles that determine when Continue.dev uses it:

- **`chat`**: Used for general conversation and Agent mode
- **`edit`**: Used for applying code changes and edits
- **`apply`**: Used for applying code changes (similar to edit)
- **`autocomplete`**: Used for tab autocompletion in editors
- **`summarize`**: Used for summarizing content
- **`embed`**: Used for generating text embeddings
- **`rerank`**: Used for re-ranking search results

**Role Priority**: When multiple models support the same role, Continue.dev prioritizes by **order in the config** (first model wins).

### **✅ Proper Folder Structure (Per Continue.dev Docs)**

The extension creates the **correct folder structure** following Continue.dev specifications:

```
.continue/
├── config.yaml              # Main config (experimental settings only)
├── models/                  # ✅ Individual model files
│   ├── gpt-4--team-.yaml
│   └── gpt-3-5-turbo--team-.yaml
├── agents/                  # ✅ Individual agent files
│   ├── codereviewer.yaml
│   ├── bugfixer.yaml
│   ├── documentationwriter.yaml
│   └── codeassistant.yaml
├── rules/                   # ✅ Individual rules files
│   ├── codestyle.yaml
│   ├── security.yaml
│   └── documentation.yaml
├── prompts/                 # ✅ Individual prompt files
│   ├── codereview.yaml
│   └── bugreport.yaml
├── docs/                    # ✅ Documentation sources
│   └── skoop-docs.yaml
├── mcpServers/              # ✅ MCP server configurations
│   └── skoop-mcp-demo.yaml
└── data/                    # ✅ Analytics configurations
    └── analytics.yaml
```

### **✅ Main Config Structure**
**`.continue/config.yaml`** (contains all configuration):
```yaml
name: "Skoop Team Config"
version: "1.0.0"
schema: "v1"
experimental:
  useChromiumForDocsCrawling: true

models:
  - name: "GPT-4 (Team)"
    provider: openai
    model: gpt-4
    apiBase: https://litellm.skoop.digital/
    apiKey: sk-Phkcy9C76yAAc2rNAAsnlg
    roles: [chat, edit, apply]
  - name: "GPT-3.5 Turbo (Team)"
    provider: openai
    model: gpt-3.5-turbo
    apiBase: https://litellm.skoop.digital/
    apiKey: sk-Phkcy9C76yAAc2rNAAsnlg
    roles: [chat, autocomplete, summarize]

rules:
  - name: CodeStyle
    rule: Always use TypeScript with strict type checking...
  - name: Security
    rule: Never commit API keys or sensitive data...

prompts:
  - name: CodeReview
    description: Standard code review prompt
    prompt: |
      Please review this code for:
      1. Code quality and readability
      2. Security vulnerabilities...
  - name: BugReport
    description: Bug report analysis prompt
    prompt: |
      Analyze this bug report:
      1. Reproduce the issue...

docs:
  - name: "Skoop Documentation"
    startUrl: https://www.skoopsignage.com/
  - name: "Skoop Documentation -2"
    startUrl: https://www.skoopsignage.com/industry/sports-entertainment
```

**`.continue/agents/`** (separate agent files):
- `codereviewer.yaml`
- `bugfixer.yaml`
- `documentationwriter.yaml`
- `codeassistant.yaml`

### **Performance & Token Usage Settings**

| Setting | GPT-4 | GPT-3.5 | Purpose |
|---------|-------|---------|---------|
| `contextLength` | 128,000 | 16,385 | Max conversation history |
| `maxTokens` | 4,096 | 2,048 | Max response length |
| `temperature` | 0.7 | 0.3 | Creativity (0.0=deterministic, 1.0=random) |
| `topP` | 1.0 | 0.9 | Token diversity (0.1=focused, 1.0=diverse) |
| `debounceDelay` | - | 150ms | Autocomplete delay |
| `maxPromptTokens` | - | 1,024 | Autocomplete context size |

### **How to Modify Settings**
1. **Edit the extension code** in `src/extension.ts` (lines 328-384)
2. **Rebuild and reinstall** the extension
3. **Restart VS Code** after applying settings

### **VS Code Extension Settings**
The extension automatically configures these Continue.dev settings:

```json
{
  "continue.enableConsole": true,        // ✅ Enable console logging
  "continue.enableTabAutocomplete": true, // ✅ Enable tab autocomplete
  "continue.enableQuickActions": true,    // ✅ Enable quick actions
  "continue.enableBetaFeatures": true     // ✅ Enable beta features
}
```

**To manually change these:**
1. Open VS Code Settings (Ctrl+,)
2. Search for "continue"
3. Modify any Continue.dev extension settings

## 🐛 **Troubleshooting**

### **Chromium Detection Issues**
If you see "Chromium not found" repeatedly:
- ✅ **Extension checks multiple locations** automatically
- ✅ **Continue.dev installs Chromium** to `~/.continue/.utils/chromium/`
- ✅ **Wait for download to complete** after first run
- ✅ **Check logs** for detailed path checking information

### **MCP Server Connection Issues**
If MCP servers fail to connect:
- ✅ **Extension automatically cleans up old MCP configs** before creating new ones
- ✅ **Creates working demo server** with `demo_echo` tool
- ✅ **Simple Node.js inline server** (no external dependencies)
- ✅ **Check VS Code output** for detailed error messages
- ✅ **Verify Node.js installation** is available in PATH
- ✅ **Wait a few seconds** for MCP server initialization
- ✅ **Look for "demo_echo" tool** in Continue.dev after connection

**If you see "Team Database" errors:**
- ✅ **Old configurations are automatically removed**
- ✅ **Restart VS Code** after running the extension
- ✅ **Clear Continue.dev cache** if issues persist

### **✅ YAML Parsing Errors Fixed**
If you see "Missing closing quote" or "Invalid input" errors:
- ✅ **YAML block scalar syntax** (`|` and `|-`) used for multiline content
- ✅ **Proper indentation** for all YAML structures
- ✅ **Quote escaping** handled correctly
- ✅ **Separate files** for complex configurations to avoid parsing conflicts
- ✅ **Simplified model configs** in individual files for reliability

### **Analytics Data Not Showing**
If Skoop Team Analytics doesn't appear:
- ✅ **File destination uses correct format** (`file:///${USERPROFILE}/.continue/analytics.jsonl`)
- ✅ **Schema version 0.2.0** with proper event configuration
- ✅ **Data written to JSONL format** for easy processing
- ✅ **Check file permissions** for the analytics directory

## Development

### Prerequisites

- Node.js 18+
- VS Code
- Continue.dev extension

### Building

```bash
npm install
npm run compile
```

### Testing

```bash
npm test
```

### Packaging

```bash
npx vsce package
```

## GitHub Actions

The repository includes a GitHub Actions workflow that:

- Builds and compiles the extension on every push/PR
- Runs linting and tests
- Packages the extension into a .vsix file
- Uploads the package as an artifact

## License

This project is licensed under the MIT License.
