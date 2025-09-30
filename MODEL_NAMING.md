# Model Naming for LiteLLM Proxy

## ⚠️ Important: Model Name Format

The model name must match what LiteLLM expects. According to the [LiteLLM documentation](https://docs.litellm.ai/docs/reasoning_content), the correct format for Claude Sonnet with reasoning is:

### Correct Model Names

```yaml
# For Claude 3.7 Sonnet (with extended thinking)
model: anthropic/claude-3-7-sonnet-20250219

# For Claude Sonnet 4 (if supported)
model: anthropic/claude-sonnet-4-20250514
```

### ❌ Incorrect Model Names

```yaml
# These will likely cause errors:
model: anthropic/claude-sonnet-4-5  # ❌ Not a valid LiteLLM model name
model: claude-sonnet-4-5            # ❌ Missing provider prefix
model: anthropic/claude-4           # ❌ Ambiguous version
```

---

## Reasoning/Thinking Parameters

According to the [LiteLLM docs](https://docs.litellm.ai/docs/reasoning_content), you must use **EITHER** `reasoning_effort` **OR** `thinking`, **NOT BOTH**.

### ✅ Correct Usage

**Option 1: Using `thinking` parameter (Recommended for Anthropic)**
```json
{
  "thinking": {
    "type": "enabled",
    "budget_tokens": 2048
  }
}
```

**Option 2: Using `reasoning_effort` parameter**
```json
{
  "reasoning_effort": "medium"
}
```

### ❌ Incorrect Usage

```json
{
  "reasoning_effort": "medium",
  "thinking": {
    "type": "enabled",
    "budget_tokens": 2048
  }
}
```

**This will cause a 400 Bad Request error!**

---

## Our Implementation

The proxy now correctly sends **only** the `thinking` parameter for Claude/Anthropic models:

```typescript
if (ollamaRequest.model.includes('claude') || ollamaRequest.model.includes('anthropic')) {
    openaiRequest.thinking = {
        type: 'enabled',
        budget_tokens: 2048
    };
}
```

---

## How to Update Your Config

### For Continue.dev (~/.continue/config.yaml)

```yaml
models:
  - name: "claude-sonnet"
    provider: ollama
    model: anthropic/claude-3-7-sonnet-20250219  # ✅ Correct format
    apiBase: http://localhost:8009
    roles:
      - chat
      - edit
    capabilities:
      - tool_use
      - image_input
```

### For Team Config (Your n8n endpoint)

Update the model name in your team configuration to use the correct format:

```yaml
models:
  - name: "claude-sonnet-4-5"
    provider: ollama
    model: anthropic/claude-sonnet-4-20250514  # Update to correct name
    apiBase: http://localhost:8009
    roles:
      - chat
      - edit
    capabilities:
      - tool_use
      - image_input
```

---

## Checking Which Models Support Reasoning

According to the LiteLLM docs, these providers support reasoning:

✅ **Supported Providers:**
- Deepseek (`deepseek/`)
- Anthropic API (`anthropic/`)
- Bedrock (Anthropic + Deepseek + GPT-OSS) (`bedrock/`)
- Vertex AI (Anthropic) (`vertexai/`)
- OpenRouter (`openrouter/`)
- XAI (`xai/`)
- Google AI Studio (`google/`)
- Vertex AI (`vertex_ai/`)
- Perplexity (`perplexity/`)
- Mistral AI (Magistral models) (`mistral/`)
- Groq (`groq/`)

### Example Models with Reasoning Support

```yaml
# Claude 3.7 Sonnet
model: anthropic/claude-3-7-sonnet-20250219

# Deepseek
model: deepseek/deepseek-chat

# XAI Grok
model: xai/grok-4-fast-reasoning

# Google Gemini
model: gemini/gemini-2.5-pro

# Perplexity
model: perplexity/sonar-reasoning
```

---

## Testing the Correct Model Name

### Test Directly with LiteLLM

```bash
curl https://litellm.skoop.digital/v1/chat/completions \
  -H "Authorization: Bearer sk-Xko8_N_iN3Q_Mrda5imWQw" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "anthropic/claude-3-7-sonnet-20250219",
    "messages": [{"role": "user", "content": "What is 2+2?"}],
    "thinking": {"type": "enabled", "budget_tokens": 2048}
  }'
```

### Test via Proxy

```bash
curl http://localhost:8009/api/chat -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "model": "anthropic/claude-3-7-sonnet-20250219",
    "messages": [{"role": "user", "content": "What is 2+2?"}],
    "stream": false
  }'
```

---

## Troubleshooting 400 Errors

If you get a 400 error, check:

1. **Model name is correct**
   - Use the full LiteLLM format: `anthropic/claude-3-7-sonnet-20250219`
   - Check the [LiteLLM supported models](https://docs.litellm.ai/docs/providers/anthropic)

2. **Only one reasoning parameter**
   - Don't send both `reasoning_effort` AND `thinking`
   - The proxy now handles this automatically

3. **Check the error details**
   - Look in Developer Console for: `[LiteLLM Proxy] LiteLLM error response`
   - This will show you the exact error from LiteLLM

---

## References

- [LiteLLM Reasoning Content Docs](https://docs.litellm.ai/docs/reasoning_content)
- [LiteLLM Anthropic Provider](https://docs.litellm.ai/docs/providers/anthropic)
- [Anthropic Extended Thinking](https://docs.anthropic.com/en/docs/build-with-claude/extended-thinking)
