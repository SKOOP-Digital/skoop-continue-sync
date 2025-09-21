# Skoop Continue Sync

A VS Code extension that synchronizes Continue.dev settings for team members, allowing centralized management of models, agents, rules, and prompts.

## Features

- **LiteLLM Integration**: Automatically configures models from your LiteLLM server
- **Team Model Management**: Sets up standardized models for different roles (chat, autocomplete, edit, agent)
- **Agent Configuration**: Deploys predefined agents for common development tasks
- **Global Rules**: Applies team-wide coding standards and best practices
- **Custom Prompts**: Provides standardized prompts for code review and bug analysis
- **Documentation Setup**: Configures team documentation sources
- **MCP Tools**: Adds Model Context Protocol servers for extended functionality
- **Analytics & Data**: Sets up data collection for team insights

## Configuration

The extension uses the following configuration options:

- `skoop-continue-sync.litellmUrl`: Your LiteLLM server URL (default: `https://litellm.skoop.digital/`)
- `skoop-continue-sync.litellmApiKey`: Your LiteLLM API key (default: test key provided)

## Usage

1. Install the extension
2. Configure your LiteLLM server URL and API key in VS Code settings
3. Run the "Apply Team Continue Settings" command from the Command Palette
4. The extension will update your Continue.dev configuration with team settings

## Team Models

The extension configures the following models from your LiteLLM server:

- **GPT-5 Mini**: For chat and autocomplete tasks
- **Gemini 2.5 Flash**: For chat and edit operations
- **Claude 4 Sonnet**: For agent and advanced chat tasks

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
