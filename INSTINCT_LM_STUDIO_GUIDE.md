# Complete Guide: Instinct Model with GPU/NPU Acceleration using LM Studio

## Overview

This guide shows you how to run the Instinct model (Continue's 7B parameter open-source model) with GPU acceleration on your Intel Core Ultra 7 258V processor using LM Studio. This gives you **significantly better performance** than CPU-only setups.

## Prerequisites

### Hardware Requirements
- **Processor**: Intel® Core™ Ultra 7 258V or higher
- **RAM**: Minimum 16GB (32GB recommended)
- **Storage**: 20GB free space for models

### Software Requirements
- **Windows 11** (22H2 or newer for best NPU support)
- **Latest Intel Graphics Drivers** (for GPU acceleration)
- **Intel NPU Drivers** (version 32.0.100.3159 or newer)

## Step 1: Install LM Studio

### Download and Install
1. Visit [LM Studio Download](https://lmstudio.ai/download)
2. Download the latest Windows version
3. Install LM Studio

### Initial Setup
1. Open LM Studio
2. Go to **Settings** → **Runtime**
3. For GPU acceleration, select:
   - **Runtime**: CUDA (if you have NVIDIA) OR
   - **Runtime**: OpenCL/Vulkan (for Intel GPU)
   - **GPU Offload**: Set to maximum (1.0)
   - **Context Length**: 4096-8192 tokens

## Step 2: Download the Instinct Model

### Find and Download
1. In LM Studio, click **"Discover"** tab
2. Search for: `nate/instinct`
3. Look for the GGUF format (optimized for local inference)
4. Download the model (typically ~4-8GB)

### Alternative Download Methods
If LM Studio search doesn't work:

1. Visit [HuggingFace Model Hub](https://huggingface.co/nate/instinct)
2. Download the GGUF format files
3. Place them in: `%USERPROFILE%\Documents\LM Studio\models\`

## Step 3: Configure GPU Acceleration

### Intel Arc GPU Setup
1. In LM Studio → **Settings** → **Hardware**
2. Enable **"Use GPU acceleration"**
3. Set **GPU Memory**: 80-90% of available
4. Enable **"Use Flash Attention"** if available

### NPU Setup (Future)
While NPU support is developing, LM Studio may add support in future versions. For now, focus on GPU acceleration.

## Step 4: Load and Test the Model

### Load the Model
1. In LM Studio, go to **"My Models"** tab
2. Find your downloaded Instinct model
3. Click **"Load"**
4. Wait for loading to complete (may take 30-60 seconds)

### Test Inference
1. Go to **"Chat"** tab
2. Test with: `"Write a simple Python function to calculate factorial"`
3. Verify GPU usage in Task Manager:
   - Intel Graphics GPU should show activity
   - CPU usage should be low (< 30%)

### Performance Check
Expected performance:
- **Response time**: 1-3 seconds for short prompts
- **GPU Memory**: 4-8GB usage
- **CPU Usage**: Low (LM Studio offloads to GPU)

## Step 5: Configure Continue.dev

### Method 1: JSON Configuration (Recommended)

Create file: `~\.continue\config.json`

```json
{
  "models": [
    {
      "title": "Instinct-LMStudio",
      "provider": "lmstudio",
      "model": "nate/instinct",
      "apiBase": "http://localhost:1234/v1",
      "completionOptions": {
        "temperature": 0.1,
        "max_tokens": 1024,
        "stop": ["<|im_end|>"]
      }
    }
  ],
  "tabAutocompleteModel": {
    "title": "Instinct-LMStudio",
    "provider": "lmstudio",
    "model": "nate/instinct",
    "apiBase": "http://localhost:1234/v1",
    "completionOptions": {
      "temperature": 0.0,
      "max_tokens": 256,
      "stop": ["<|im_end|>", "\n\n"]
    }
  },
  "embeddingsProvider": {
    "provider": "transformers",
    "model": "all-MiniLM-L6-v2"
  }
}
```

### Method 2: YAML Configuration

Create file: `~\.continue\config.yaml`

```yaml
name: "LM Studio - Instinct"
version: "1.0.0"
schema: "v1"

models:
  - name: "Instinct-LMStudio"
    provider: "lmstudio"
    model: "nate/instinct"
    apiBase: "http://localhost:1234/v1"
    roles:
      - "chat"
      - "edit"
      - "next_edit"
    defaultCompletionOptions:
      temperature: 0.1
      maxTokens: 1024
      stop:
        - "<|im_end|>"

tabAutocompleteModel:
  name: "Instinct-LMStudio"
  provider: "lmstudio"
  model: "nate/instinct"
  apiBase: "http://localhost:1234/v1"
  defaultCompletionOptions:
    temperature: 0.0
    maxTokens: 256
    stop:
      - "<|im_end|>"
      - "\n\n"

embeddingsProvider:
  provider: "transformers"
  model: "all-MiniLM-L6-v2"

experimental:
  useChromiumForDocsCrawling: true
```

## Step 6: Start the LM Studio Server

### Automatic Server
1. In LM Studio, load your Instinct model
2. The server should start automatically on port 1234
3. Look for: **"Server running on http://localhost:1234"**

### Manual Server Start
If auto-start doesn't work:
1. Go to **"Local Server"** tab in LM Studio
2. Click **"Start Server"**
3. Verify port 1234 is available

 if it doesn't manually start, run
   lms server start --port 3000

## Step 7: Test Continue.dev Integration

### In VS Code
1. Open VS Code with Continue.dev extension
2. Restart VS Code (important!)
3. Open Continue panel (Ctrl/Cmd + L)
4. Select "Instinct-LMStudio" model

### Test Features
1. **Chat**: Ask coding questions
2. **Autocomplete**: Type code and see suggestions
3. **Next Edit**: Use "Edit" mode for code modifications

### Performance Verification
- **Response Speed**: Should be fast (1-3 seconds)
- **GPU Activity**: Task Manager shows Intel GPU usage
- **CPU Usage**: Should stay low (< 30%)

## Optimization Tips

### Model Settings
- **Context Length**: 4096-8192 tokens
- **Temperature**: 0.0-0.3 for code
- **Top-P**: 0.9-1.0
- **Repeat Penalty**: 1.1-1.2

### LM Studio Settings
- **Threads**: Match your CPU cores (6-8 for Ultra 7)
- **GPU Layers**: Maximum available
- **Flash Attention**: Enable for speed boost
- **Cache**: Enable KV cache for faster responses

### Memory Management
- **GPU Memory**: 80-90% of available
- **System RAM**: Keep 8GB free for system
- **Model Unload**: Unload unused models to free memory

## Troubleshooting

### Model Won't Load
- **Check GPU Memory**: Ensure enough VRAM available
- **Update Drivers**: Latest Intel Graphics drivers
- **Restart LM Studio**: Sometimes fixes loading issues

### Continue.dev Can't Connect
- **Check Port**: Verify LM Studio server on port 1234
- **Firewall**: Allow LM Studio through firewall
- **Restart VS Code**: Required after config changes

### Poor Performance
- **CPU High**: Check if GPU acceleration is enabled
- **Slow Responses**: Increase GPU offload in LM Studio
- **Out of Memory**: Reduce context length or model size

### GPU Not Detected
- **Update Drivers**: Latest Intel Graphics drivers
- **BIOS Settings**: Ensure iGPU is enabled
- **Power Settings**: Set to "Best Performance"

## Advanced Configuration

### Custom Model Parameters
```json
{
  "completionOptions": {
    "temperature": 0.1,
    "top_p": 0.95,
    "top_k": 40,
    "repetition_penalty": 1.1,
    "max_tokens": 1024
  }
}
```

### Multiple Models
```json
{
  "models": [
    {
      "title": "Instinct-Fast",
      "provider": "lmstudio",
      "model": "nate/instinct",
      "apiBase": "http://localhost:1234/v1"
    },
    {
      "title": "Instinct-Creative",
      "provider": "lmstudio",
      "model": "nate/instinct",
      "apiBase": "http://localhost:1234/v1",
      "completionOptions": {
        "temperature": 0.7,
        "max_tokens": 2048
      }
    }
  ]
}
```

## Future NPU Support

While LM Studio doesn't currently support Intel NPU:
- **Monitor Updates**: Check LM Studio releases for NPU support
- **Intel Progress**: NPU support is improving in AI frameworks
- **Current Best**: GPU acceleration gives excellent performance

## Files Included

- `continue_config_lmstudio.json` - Ready-to-use JSON config
- `continue_config_lmstudio.yaml` - Alternative YAML config
- `LM_STUDIO_SETUP_COMPLETE.md` - Quick reference guide

## Performance Comparison

| Setup | CPU Usage | Response Time | GPU Usage |
|-------|-----------|---------------|-----------|
| CPU Only (Ollama) | 100% | 10-30s | 0% |
| **LM Studio GPU** | 20-30% | 1-3s | 80-90% |
| Future NPU | < 10% | < 1s | N/A |

---

**Congratulations!** You now have Instinct running with GPU acceleration on your Intel hardware. This provides excellent performance for coding assistance with Continue.dev.
