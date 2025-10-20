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
4.  Run the "Apply Team Continue Settings" command from the settings or command palette (`Ctrl+Shift+P`). Should run automatically.

You can also clear all configurations by running the `Clear All Continue Configurations` command.

The configuration is fetched from the following n8n workflows:
[https://n8n.skoopsignage.dev/workflow/uBcGGDcJkoTGSHDa](https://n8n.skoopsignage.dev/workflow/uBcGGDcJkoTGSHDa)

### Recommendations:
- Move cursor chat to right sidebar. Drag the cursor Icon in the left sidebar to the right sidebar.
- In Continue.dev Settings (click gear icon in continue.dev chat)
    - Show Chat Scrollbar: Toggle on to see chat scrollbar

## Usage

Check model usage and remaining budget using the Skoop LLM usage tool: 
[https://n8n.skoopsignage.dev/webhook/llm-usage](https://n8n.skoopsignage.dev/webhook/llm-usage)

## Model Options

### Chat & Edit Models
Full-featured models for conversation and code editing.

#### Recommended general models:
- **Grok-4-Fast-Reasoning** (Recommended, Default) - Great model. Topping charts, fast, cheap, reasoning enabled, image support, large 2M context window, prompt-caching support.  $0.20 input/$0.50 output/$0.05 cached input

#### Top-tier model (expensive)
- **Claude-Sonnet-4-5** - Premium model, best available, reasoning responses included. Much more expensive than Grok-4-fast. Prompt-caching supported but not ashelpful as other auto prompt-caching providers. $3-3.75 input/$15 output/$0.3 cached input

#### Other models available:
- **Gemini-2.5-Pro** - Good model. Bit older, decent model, not as cheap as Grok-4-fast, Large context 1M context. $1.25-2.50 input/$10-15 output/$0.3-0.6 cached input
- **Grok-4-Fast-Non-Reasoning** same Grok-4-Fast with reasoning disabled. Great model. Topping charts, fast, cheap, reasoning enabled, image support, large 2M context window, prompt-caching support.  $0.20 input/$0.50 output/$0.05 cached input
- **Grok-Code-Fast-1** - Code-optimized, smaller context window, no image support, doesn't seem to work as good as Grok-4-Fast. $0.20 input/$0.50 output/$0.05 cached input
- **GLM-4.6** - Decent newly released model, touted as a cheaper alternative to Claude. $0.60 input/$2.20 output

#### Local models available (Local via LM Studio or other openai compatible local server) (see below for setup):
- **Qwen3-Coder-30B** - Decent coding optimized model. Runs on many GPU/CPU. Must  be powerfull an/or very modern. Pretty slow depending on hardware.
- **DeepSeek-R1-0528-Qwen3-8B** - small local model

### Autocomplete Models
Fast, specialized models for code completion. Codestral is best for now, but continue.dev autocomplete is not amazing. Updates and new configs will come soon:
- **Codestral** - Fast decent autocomplete modelfrom Mistral.
- **Mercury Coder** (Inception) - Optimized for next-edit predictions. next-edit is continue.dev's newer autocomplete strategy. This option is available and promising, but needs some tweaking before it's reccomended.
- **Instinct-LMStudio** - Local autocomplete model via LM Studio or other openai compatible local server (see below for setup). Slow. It's continue.dev's reccomended next-edit capable autocomplete model, but is very slow locally. Waiting on an API option.

### Specialized Models
- **Morph Fast Apply** (Recommended, Default) - Optimized for code application tasks. Great, fast, apply model for applying codechanges to existing files.
- **Morph Embedding v2** - High-quality code embeddings. Not used by default instead defaulting to built in local transformers.js.
- **Morph Rerank v2** - Advanced code reranking, rarely used for documentation and context ordering.

*Pricing shown is per 1M tokens. Cached input pricing available for all models.

## Auto-Updates

The extension includes automatic update checking to keep your installation current.

### Update Settings

You can configure auto-update behavior in VS Code settings:

- `Skoop Continue Sync: Enable Auto Updates` - Enable/disable automatic update checks
- `Skoop Continue Sync: Refresh Interval` - Set check frequency for both config and extension updates
- `Skoop Continue Sync: Check For Updates` - Manually trigger an update check
- `Skoop Continue Sync: Install Update` - Install available updates

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