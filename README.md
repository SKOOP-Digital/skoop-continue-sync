# Skoop Continue Sync

A VS Code extension that synchronizes Continue.dev settings for team members by fetching a centralized configuration from a secure endpoint. This allows for consistent management of models, agents, rules, and prompts across the entire team.

## Features

- **Centralized Configuration**: All settings are loaded from a secure n8n webhook.
- **Automatic Refresh**: Configuration is automatically refreshed every 24 hours to ensure settings are always up-to-date.
- **Manual Sync**: A command is available to manually trigger a configuration refresh at any time.
- **Auto-Update**: Extension automatically checks for updates and notifies users when new versions are available.
- **Team-Managed Agents**: Pre-defined agents for tasks like code review, bug fixing, and documentation are deployed to all team members.
- **Standardized Models**: Ensures all team members use the same models with consistent settings and roles.
- **Global Rules & Prompts**: Enforces team-wide coding standards and provides standardized prompts.

## Prerequisites

- [Visual Studio Code](https://code.visualstudio.com/)

## Installation

1.  **Download the Extension**:
    *   [Download the latest `.vsix` file here](https://github.com/SKOOP-Digital/skoop-continue-sync/releases/latest/download/skoop-continue-sync.vsix).
2.  **Install in VS Code**:
    *   Open VS Code.
    *   Go to the Extensions view (`Ctrl+Shift+X`).
    *   Click the "..." menu in the top-right corner and select "Install from VSIX...".
    *   Select the downloaded `.vsix` file.
## Configuration

After installation, you need to configure your team API key in VS Code settings:

1.  Open VS Code Settings (`Ctrl+,`).
2.  Search for `Skoop Continue Sync`.
3.  In the `Skoop-continue-sync: Api Key` field, enter the key provided to you.
4.  Run the "Apply Team Continue Settings" command from the settings or command palette (`Ctrl+Shift+P`).

### Team Keys

For now, you can use one of the following keys:

-   `josh_m:sk-Xko8_N_iN3Q_Mrda5imWQw`
-   `shahzad_h:sk-fzTwcJQwGcWbvKmb0-7-Iw`

The configuration is fetched from the following n8n workflows:
[https://n8n.skoopsignage.dev/workflow/uBcGGDcJkoTGSHDa](https://n8n.skoopsignage.dev/workflow/uBcGGDcJkoTGSHDa)

## Auto-Updates

The extension includes automatic update checking to keep your installation current.

### Update Settings

You can configure auto-update behavior in VS Code settings:

- `Skoop Continue Sync: Enable Auto Updates` - Enable/disable automatic update checks
- `Skoop Continue Sync: Refresh Interval` - Set check frequency for both config and extension updates
- `Skoop Continue Sync: Check For Updates` - Manually trigger an update check
- `Skoop Continue Sync: Install Update` - Install available updates

## Usage

Once the extension is installed and configured, it will automatically sync the team's `continue.dev` settings. You can also manually trigger a sync:

1.  Open the Command Palette (`Ctrl+Shift+P`).
2.  Type `Skoop Continue Sync` and select `Apply Team Continue Settings`.
3.  The extension will fetch the latest configuration and apply it.

You can also clear all configurations by running the `Clear All Continue Configurations` command.

## Model Options

### Main Models:

### Autocomplete Models
Fast, specialized models for code completion:
- **Codestral** (Mistral) - Lightning-fast autocomplete with 250ms debounce
- **Mercury Coder** (Inception) - Optimized for next-edit predictions
- **Instinct-LMStudio** - Local model via LM Studio for offline use

### Chat & Edit Models
Full-featured models for conversation and code editing:
- **Grok-4-Fast-Reasoning** (xAI) - Balanced reasoning with 2M context, $0.20 input/$0.50 output
- **Grok-4-Fast-Non-Reasoning** (xAI) - Fast responses, $0.20 input/$0.50 output
- **Grok-Code-Fast-1** (xAI) - Code-optimized, $0.20 input/$0.50 output
- **GLM-4.6** - Advanced reasoning with thinking tokens, $0.60 input/$2.20 output
- **Gemini-2.5-Pro** (Google) - Large context model, $1.25-2.50 input/$10-15 output
- **GPT-5** (OpenAI) - Enterprise-grade, $1.25 input/$10 output
- **Claude-Sonnet-4-5** (Anthropic) - Premium reasoning, $3-3.75 input/$15 output
- **Qwen3-Coder-30B** (Local via LM Studio) - Local coding specialist
- **DeepSeek-R1-0528-Qwen3-8B** (Local via LM Studio) - Local reasoning model

### Specialized Models
- **Morph Fast Apply** (OpenAI) - Optimized for code application tasks
- **Morph Embedding v2** - High-quality code embeddings
- **Morph Rerank v2** - Advanced code reranking

### Recommendations
- **For general coding**: Grok-4-Fast-Reasoning or GLM-4.6 (excellent balance of speed and quality)
- **For complex reasoning**: Claude-Sonnet-4-5 or GPT-5 (premium performance)
- **For local/offline use**: Instinct-LMStudio or Qwen3-Coder-30B via LM Studio
- **For cost efficiency**: Grok models offer the best value for most coding tasks

*Pricing shown is per 1M tokens. Cached input pricing available for supported models.

## How It Works: The Configuration File

The extension fetches a single YAML file from the n8n webhook. This file contains all the necessary configurations for `continue.dev` across the team. Here’s a breakdown of its structure.

### Top-Level Structure

The YAML file is expected to have two main sections: `settings` and `Agents`.

#### Settings Section

The `settings` section contains vscode settings and continue settings

#### Agents Section

The `agents` section contins configurations for models, rules, docs, mcp servers, and prompts. 
There can be multiple agents, each with their own set of these configurations.
The first agent must always be the 'local agent' and acts as the default.
Models are applied in order of how they appear in the configuration and the roles they have. They can be changed inthe continue settings for the

---

## Appendix: Setting Up LM Studio with the Instinct Model

For optimal performance, especially on hardware with Intel GPUs, we recommend running the Instinct model locally using LM Studio. This guide provides a comprehensive walkthrough for setting up LM Studio and integrating it with `continue.dev`.

### Why Use LM Studio?

-   **GPU Acceleration**: LM Studio provides excellent support for GPU acceleration on a wide range of hardware, including Intel GPUs, which significantly speeds up model inference.
-   **Low CPU Usage**: By offloading the model to the GPU, your CPU remains free for other tasks.
-   **Better Performance**: For local models, LM Studio generally offers better performance and stability than other solutions like Ollama, especially on non-NVIDIA hardware.

### Step 1: Install and Configure LM Studio

1.  **Download LM Studio**: Visit the [LM Studio website](https://lmstudio.ai/) and download the application for your operating system.
2.  **Install LM Studio**: Follow the installation instructions.
3.  **Configure Hardware Settings**:
    *   Open LM Studio and navigate to the **Settings** (the gear icon on the left).
    *   Under the **Hardware** section, ensure that **GPU Acceleration** is enabled. For most non-NVIDIA GPUs, the `OpenCL` or `Vulkan` backend should be used.
    *   It is recommended to offload as many layers as possible to the GPU.

### Step 2: Download the Instinct Model

1.  **Search for the Model**: In LM Studio, click on the **Discover** tab (the magnifying glass icon).
2.  **Find Instinct**: In the search bar, type `nate/instinct`.
3.  **Download the GGUF Version**: From the search results, select the `nate/instinct` model. On the right side of the screen, you will see a list of available files. Download one of the `GGUF` format models. The `Q4_K_M` version is often a good balance of performance and quality.

### Step 3: Load the Model and Start the Server

1.  **Load the Model**:
    *   Navigate to the **My Models** tab (the folder icon).
    *   You should see the `nate/instinct` model you just downloaded. Click on it to load it.
2.  **Start the Local Server**:
    *   Go to the **Local Server** tab (the `<->` icon).
    *   Click the **Start Server** button.
    *   The server will start, typically on port `1234`.
3.  **Now you can select the instinct model**