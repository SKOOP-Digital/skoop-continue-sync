# Quick Start: Using Anthropic Format for Native Thinking

## 🚀 Ready to Use!

The proxy has been completely refactored to use **Anthropic format** for native thinking support in Continue.dev.

---

## ⚡ Quick Setup (3 Steps)

### Step 1: Reload VS Code

```
Ctrl+Shift+P → "Developer: Reload Window"
```

Look for this notification:
```
✅ LiteLLM Proxy started on port 8009
```

### Step 2: Update Your Continue Config

Open `C:\Users\JoshS\.continue\config.yaml` and add/update the model:

```yaml
models:
  - name: "claude-sonnet-4"
    provider: anthropic
    model: anthropic/claude-sonnet-4-20250514
    apiBase: http://localhost:8009
    apiKey: "dummy"
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

**Save the file** and Continue.dev will automatically reload the config.

### Step 3: Test in Continue.dev

1. Open Continue.dev sidebar
2. Select "claude-sonnet-4" from model dropdown
3. Send a message: `Hi! Can you help me understand this code?`

**Expected Results**:
- ✅ Response appears in chat
- ✅ Thinking blocks displayed in special UI (expandable/collapsible)
- ✅ Tool calls work correctly
- ✅ Multi-turn conversations work

---

## 🔍 Verify It's Working

### Open Developer Console
```
Help → Toggle Developer Tools → Console tab
```

### Look for These Logs

**When you send a message**:
```
[LiteLLM Proxy XXXXX] POST /v1/messages
[LiteLLM Proxy XXXXX] Anthropic request: {...}
[LiteLLM Proxy XXXXX] OpenAI request: {...}
[LiteLLM Proxy XXXXX] Forwarding to https://litellm.skoop.digital/v1/chat/completions
```

**When thinking is detected**:
```
[LiteLLM Proxy XXXXX] *** REASONING CONTENT DETECTED ***: The user wants me to...
[LiteLLM Proxy XXXXX] Added 1 thinking blocks to response
```

**Success indicators**:
```
✅ [LiteLLM Proxy XXXXX] LiteLLM response status: 200
✅ [LiteLLM Proxy XXXXX] Streamed 5 thinking blocks
✅ reasoning_tokens: 64  (in usage stats)
```

---

## 🎯 What Makes This Better

### Old Way (Ollama)
- Thinking embedded in text with `<thinking>` tags
- Continue.dev couldn't recognize it as thinking
- Displayed as plain text
- Broke multi-turn conversations

### New Way (Anthropic)
- ✅ Native `thinking_blocks` in response
- ✅ Continue.dev recognizes and displays specially
- ✅ Collapsible thinking UI
- ✅ Clean conversation history
- ✅ Perfect multi-turn support

---

## 🧪 Test Cases

### Test 1: Basic Chat with Thinking
**Send**: `Explain how async/await works in JavaScript`

**Expected**:
- Thinking block appears (collapsed/expandable)
- Response is clear and detailed
- No errors in console

### Test 2: Tool Calling
**Send**: `Can you read the package.json file?`

**Expected**:
- Tool is called
- File contents displayed
- No errors about tool_call_id

### Test 3: Multi-Turn Conversation
**Send**: `Hi! Can you help me?`  
**Then**: `Thanks! Now can you list the files?`

**Expected**:
- Both turns work
- Second turn remembers context
- No 400 errors

### Test 4: Image Support (if you have images)
**Send an image with**: `What's in this image?`

**Expected**:
- Image is processed
- Description provided

---

## 🐛 Troubleshooting

### Issue: "Connection refused"
**Check**: Is the proxy running?
```
Look for: [LiteLLM Proxy] Server listening on http://localhost:8009
```

### Issue: "Invalid API key" or auth errors  
**Fix**: Add `apiKey: "dummy"` to your model config (Continue.dev requires it)

### Issue: No thinking blocks visible
**Check Developer Console** for:
```
[LiteLLM Proxy] *** REASONING CONTENT DETECTED ***
```

If you don't see this:
- Model might not support reasoning
- max_tokens might be too small (needs > 2048)

### Issue: 400 Bad Request errors
**Check the error** in Developer Console:
```
[LiteLLM Proxy] LiteLLM error response (400): {...}
```

Common causes:
- Model name incorrect (use `anthropic/claude-sonnet-4-20250514`)
- max_tokens too small (< 2048 when thinking enabled)
- Invalid message format

---

## 📚 Full Documentation

- [LITELLM_PROXY_GUIDE.md](LITELLM_PROXY_GUIDE.md) - Complete setup guide
- [MIGRATION_TO_ANTHROPIC_FORMAT.md](MIGRATION_TO_ANTHROPIC_FORMAT.md) - Detailed migration info
- [THINKING_CONTENT_STATUS.md](THINKING_CONTENT_STATUS.md) - Thinking feature status
- [MODEL_NAMING.md](MODEL_NAMING.md) - Correct model names for LiteLLM

---

## 🎊 You're Ready!

**Reload VS Code** and update your Continue config to `provider: anthropic`. 

You'll now have **native thinking support** with proper UI display! 🚀

---

**Last Updated**: 2025-09-30  
**Format**: Anthropic API (v1/messages)  
**Thinking**: ✅ Fully Functional
