# Skoop Continue Sync

A VS Code extension that synchronizes Continue.dev settings for team members, allowing centralized management of models, agents, rules, and prompts.

## Features

- **LiteLLM Integration**: Automatically configures models from your LiteLLM server
- **Team Model Management**: Sets up standardized models for different roles (chat, autocomplete, edit, agent)
- **Agent Configuration**: Deploys predefined agents for common development tasks
- **Global Rules**: Applies team-wide coding standards and best practices
- **Custom Prompts**: Provides standardized prompts for code review and bug analysis

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
