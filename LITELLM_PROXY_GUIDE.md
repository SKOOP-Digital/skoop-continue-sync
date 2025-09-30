# LiteLLM Proxy for Continue.dev - Setup Guide

This extension now includes a built-in proxy server that allows Continue.dev to use LiteLLM models with full reasoning/thinking support, even though Continue.dev only natively supports reasoning with Anthropic and Ollama providers.

## What This Does

The proxy server:
1. Listens on `localhost:8009`
2. Accepts requests from Continue.dev in Ollama format
3. Converts them to OpenAI/LiteLLM format with reasoning parameters
4. Forwards to LiteLLM API at `https://litellm.skoop.digital`
5. Converts responses back to Ollama format (including thinking/reasoning content)
6. Returns to Continue.dev with full reasoning support

## Features

- ✅ **Full Reasoning Support**: Access thinking/reasoning tokens from Claude Sonnet 4.5, Deepseek, and other reasoning models
- ✅ **Streaming Support**: Real-time response streaming
- ✅ **Tool Calling**: Full support for function/tool calls
- ✅ **Image Support**: Vision models work with base64 image inputs
- ✅ **Automatic Format Conversion**: Seamless Ollama ↔ OpenAI format conversion
- ✅ **Comprehensive Logging**: All requests/responses logged to VS Code Developer Console

## How to Use

### Step 1: Install and Activate Extension

The proxy server starts automatically when the extension activates. You'll see a notification:
```
LiteLLM Proxy started on port 8009
```

### Step 2: Configure Continue.dev

Add models to your Continue.dev config (`~/.continue/config.yaml`) using this format:

```yaml
models:
  - name: "claude-sonnet-4-5"
    provider: ollama                           # Must be "ollama" for Continue to recognize it
    model: anthropic/claude-sonnet-4-5         # Actual LiteLLM model name
    apiBase: http://localhost:8009             # Points to our proxy
    roles:
      - chat
      - edit
    requestOptions:
      extraBodyProperties:
        thinking:
          type: "enabled"
          budget_tokens: 2048
    defaultCompletionOptions:
      contextLength: 200000
      maxTokens: 30000
      reasoning: true
      reasoningBudgetTokens: 2048
      promptCaching: true  
    capabilities:
      - tool_use
      - image_input
```

**Key Points:**
- `provider: ollama` - Continue.dev sees this as an Ollama model
- `model: anthropic/claude-sonnet-4-5` - The actual model name for LiteLLM
- `apiBase: http://localhost:8009` - Points to our proxy server

### Step 3: Use in Continue.dev

Simply select "claude-sonnet-4-5" (or your configured model name) from the model dropdown in Continue.dev and start chatting! The model will now include reasoning/thinking content in responses.

## Supported Models

The proxy works with any LiteLLM-supported model, but reasoning features are automatically enabled for:

- **Anthropic Claude**: `anthropic/claude-sonnet-4-5`, `anthropic/claude-sonnet-4-20250514`
- **Deepseek**: `deepseek/deepseek-chat`, `deepseek/deepseek-reasoner`
- **Google Gemini**: `gemini/gemini-2.5-pro`
- **XAI Grok**: `xai/grok-4-fast-reasoning`
- **OpenAI**: `gpt-5`, `gpt-5-c` (if available)
- And more...

## Configuration Examples

### Claude Sonnet 4.5 (Primary Recommendation)

```yaml
- name: "claude-sonnet-4-5"
  provider: ollama
  model: anthropic/claude-sonnet-4-5
  apiBase: http://localhost:8009
  roles:
    - chat
    - edit
  defaultCompletionOptions:
    contextLength: 200000
    maxTokens: 30000
    reasoning: true
    reasoningBudgetTokens: 2048
    promptCaching: true  
  capabilities:
    - tool_use
    - image_input
```

### Deepseek Chat

```yaml
- name: "deepseek-chat"
  provider: ollama
  model: deepseek/deepseek-chat
  apiBase: http://localhost:8009
  roles:
    - chat
    - edit
  defaultCompletionOptions:
    contextLength: 64000
    maxTokens: 8000
    reasoning: true
    reasoningBudgetTokens: 1024
  capabilities:
    - tool_use
```

### Gemini 2.5 Pro

```yaml
- name: "gemini-2-5-pro"
  provider: ollama
  model: gemini/gemini-2.5-pro
  apiBase: http://localhost:8009
  roles:
    - chat
    - edit
  defaultCompletionOptions:
    contextLength: 1048570
    maxTokens: 65530
    reasoning: true
    reasoningBudgetTokens: 2048
  capabilities:
    - tool_use
    - image_input
```

## Troubleshooting

### Check if Server is Running

Open the VS Code Developer Console (Help → Toggle Developer Tools → Console tab) and look for:
```
[LiteLLM Proxy] Server listening on http://localhost:8009
```

### View Request/Response Logs

All requests and responses are logged to the VS Code Developer Console with detailed information:
```
[LiteLLM Proxy 1735123456789] POST /api/chat
[LiteLLM Proxy 1735123456789] Ollama request: {...}
[LiteLLM Proxy 1735123456789] OpenAI request: {...}
[LiteLLM Proxy 1735123456789] LiteLLM response status: 200
[LiteLLM Proxy 1735123456789] Including reasoning content in response
```

### Test the Proxy

You can test the proxy directly with curl:

```bash
curl http://localhost:8009/api/chat -X POST -H "Content-Type: application/json" -d '{
  "model": "anthropic/claude-sonnet-4-5",
  "messages": [
    {"role": "user", "content": "What is 2+2? Think step by step."}
  ],
  "stream": false
}'
```

### Common Issues

**"Connection refused" error:**
- Make sure the extension is activated and the proxy server started
- Check the VS Code Developer Console for any error messages

**"Model not found" error:**
- Verify the model name matches LiteLLM's format (e.g., `anthropic/claude-sonnet-4-5`)
- Check that the LiteLLM API key is valid

**No reasoning content in responses:**
- Only certain models support reasoning (Claude, Deepseek, Gemini, etc.)
- Check the VS Code Developer Console to see if reasoning parameters are being sent

## API Key Configuration

The proxy uses the API key: `sk-Xko8_N_iN3Q_Mrda5imWQw`

This is hardcoded for the Skoop team. If you need to use a different API key, modify the `LITELLM_API_KEY` constant in `src/extension.ts`.

## How Reasoning/Thinking Content is Displayed

The proxy automatically includes reasoning content in the response:

1. **Non-streaming**: Thinking content is prepended to the response:
   ```
   <thinking>
   [reasoning steps here]
   </thinking>

   [actual response]
   ```

2. **Streaming**: Thinking chunks are wrapped in `<thinking>` tags as they arrive

Continue.dev will display this content inline, allowing you to see the model's reasoning process.

## Technical Details

### Endpoints Supported

- `GET /api/tags` - Returns available models list (Ollama format)
- `GET /v1/models` - Returns available models list (OpenAI format)
- `POST /api/chat` - Chat completions (Ollama format)
- `POST /v1/chat/completions` - Chat completions (OpenAI format)
- `POST /api/generate` - Text generation (Ollama format)

### Format Conversions

**Ollama → OpenAI:**
- Messages array: Direct conversion
- Images: Base64 → `image_url` format
- Options: `temperature`, `top_p`, `max_tokens`, `num_predict`
- Auto-adds reasoning parameters for supported models

**OpenAI → Ollama:**
- Response structure conversion
- `reasoning_content` → `<thinking>` tags
- Tool calls preservation
- Usage stats mapping

### Reasoning Parameters

For Claude/Anthropic models, the proxy automatically adds:
```json
{
  "reasoning_effort": "medium",
  "thinking": {
    "type": "enabled",
    "budget_tokens": 2048
  }
}
```

## Performance Notes

- **Latency**: Adds ~10-50ms overhead for format conversion
- **Streaming**: Full streaming support with minimal buffering
- **Memory**: Lightweight, runs in extension host process
- **Logging**: Verbose logging may impact performance slightly; logs can be filtered in Developer Console

## Future Enhancements

Potential improvements:
- [ ] Configurable API keys via VS Code settings
- [ ] Support for multiple LiteLLM endpoints
- [ ] Configurable reasoning levels (low/medium/high)
- [ ] Response caching
- [ ] Request/response metrics dashboard
- [ ] Custom model configuration UI

## Support

For issues or questions:
1. Check the VS Code Developer Console for detailed logs
2. Review this guide for configuration examples
3. Contact the Skoop team for API key or LiteLLM endpoint issues

---

**Version**: 1.0.0  
**Last Updated**: 2025-01-29
