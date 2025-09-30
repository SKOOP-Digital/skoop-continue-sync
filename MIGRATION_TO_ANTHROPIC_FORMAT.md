# Migration Guide: Ollama → Anthropic Format

## 🎉 Major Improvement: Native Thinking Support!

We've refactored the proxy to use **Anthropic format** instead of Ollama format. This provides **native thinking display** in Continue.dev!

---

## What Changed

### Before (Ollama Format)
```yaml
models:
  - name: "claude-sonnet-4-5"
    provider: ollama  # ❌ Old way
    model: anthropic/claude-sonnet-4-5
    apiBase: http://localhost:8009
```

**Problems:**
- ❌ Thinking embedded in `<thinking>` tags (hacky)
- ❌ Conversation history contamination
- ❌ Multi-turn tool calling broken
- ❌ No native thinking UI in Continue.dev

### After (Anthropic Format)
```yaml
models:
  - name: "claude-sonnet-4"
    provider: anthropic  # ✅ New way!
    model: anthropic/claude-sonnet-4-20250514
    apiBase: http://localhost:8009
    apiKey: "dummy"  # Required by Continue.dev
```

**Benefits:**
- ✅ Native thinking blocks (Continue.dev displays them properly!)
- ✅ Clean conversation history
- ✅ Multi-turn conversations work perfectly
- ✅ Tool calls work correctly
- ✅ Thinking UI in Continue.dev

---

## Migration Steps

### Step 1: Reload VS Code
The extension has been updated. Reload VS Code to get the new proxy server:
```
Ctrl+Shift+P → "Developer: Reload Window"
```

### Step 2: Update Continue.dev Config

Edit `~/.continue/config.yaml` (or `C:\Users\YourName\.continue\config.yaml` on Windows):

**Replace this:**
```yaml
models:
  - name: "claude-sonnet-4-5"
    provider: ollama
    model: anthropic/claude-sonnet-4-5
    apiBase: http://localhost:8009
    roles:
      - chat
      - edit
```

**With this:**
```yaml
models:
  - name: "claude-sonnet-4"
    provider: anthropic  # Changed!
    model: anthropic/claude-sonnet-4-20250514  # Updated model name
    apiBase: http://localhost:8009
    apiKey: "dummy"  # Added (required by Continue.dev)
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
      promptCaching: true
    capabilities:
      - tool_use
      - image_input
```

### Step 3: Restart Continue.dev

After editing the config:
1. Reload VS Code again (or wait for Continue.dev to detect the config change)
2. Open Continue.dev chat
3. Select your model
4. Start chatting!

---

## What You'll See Now

### Before (Ollama Format)
Thinking content appeared as regular text with `<thinking>` tags:
```
<thinking>
The user wants me to help with...
</thinking>

I'll help you with that.
```

### After (Anthropic Format)  
Continue.dev displays thinking in a **special collapsed UI block**:
```
[Thinking] ▼ (click to expand)
  The user wants me to help with...

I'll help you with that.
```

---

## Technical Changes

### Proxy Server Changes

#### Old Endpoints (Ollama):
- `/api/show` - Model info
- `/api/tags` - Model list
- `/api/chat` - Chat (NDJSON streaming)
- `/api/generate` - Completions

#### New Endpoints (Anthropic):
- `/v1/models` - Model list
- `/v1/messages` - Chat (SSE streaming)
- `/v1/chat/completions` - Chat (also supported)

### Format Conversion Changes

#### Request Conversion (Anthropic → OpenAI)
- **System messages**: Extracted from separate `system` field
- **Content blocks**: Converted to OpenAI format
- **Images**: Anthropic base64 source → OpenAI image_url
- **Thinking**: Passed through or auto-added

#### Response Conversion (OpenAI → Anthropic)
- **Thinking blocks**: Native `thinking_blocks` preserved!
- **Content**: Converted to Anthropic content block array
- **Tool calls**: OpenAI format → Anthropic `tool_use` blocks
- **Streaming**: Server-Sent Events (SSE) format

---

## Benefits Summary

### 1. Native Thinking Display
Continue.dev's Anthropic integration includes special UI for thinking blocks. No more manual `<thinking>` tag parsing!

### 2. Proper Multi-Turn Conversations
The old approach broke multi-turn conversations because:
- Assistant message had modified content with `<thinking>` tags
- Tool responses referenced tool calls from modified messages
- Anthropic API rejected the invalid format

The new approach:
- ✅ Thinking blocks are separate from content
- ✅ Tool calls reference unchanged messages
- ✅ Anthropic API accepts the format natively

### 3. Better Tool Calling
Tool calls now work perfectly across multiple turns:
```
User: "Read package.json"
Assistant: [Uses ls tool]
User: "What does it do?"
Assistant: [Continues conversation]  ✅ Works!
```

### 4. Cleaner Code
- Removed thinking tag stripping logic
- Removed thinking tag embedding logic
- Native format conversion (no hacks!)

---

## Compatibility Notes

### Supported LiteLLM Models

All models that support thinking via LiteLLM will work:
- ✅ Claude Sonnet 4, 3.7 Sonnet
- ✅ Deepseek Chat
- ✅ Gemini 2.5 Pro
- ✅ XAI Grok with reasoning
- ✅ And more...

### Continue.dev Version

Requires Continue.dev with Anthropic provider support (most recent versions have this).

---

## Verification

### Check Proxy is Using Anthropic Format

In Developer Console, look for:
```
[LiteLLM Proxy] Anthropic request: {...}
[LiteLLM Proxy] *** REASONING CONTENT DETECTED ***: ...
[LiteLLM Proxy] Added 1 thinking blocks to response
```

### Check Continue.dev is Showing Thinking

In Continue.dev chat, you should see thinking blocks displayed in a special expandable/collapsible format (not as plain text with `<thinking>` tags).

---

## Rollback (If Needed)

If you need to rollback to the old Ollama format:

1. Checkout previous commit:
   ```bash
   git checkout d9cb4dd
   ```

2. Recompile:
   ```bash
   npm run compile
   ```

3. Update Continue config back to `provider: ollama`

---

**Migration Complete!** 🎉

Now you have **native thinking support** with proper UI display in Continue.dev!
