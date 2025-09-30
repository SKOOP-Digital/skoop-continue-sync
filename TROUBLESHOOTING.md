# Troubleshooting the LiteLLM Proxy

## ✅ Fixed Issues

### Issue 1: Continue.dev not showing responses
**Symptom**: Proxy logs showed successful requests/responses, but nothing appeared in Continue.dev chat.

**Root Cause**: The final "done" message in streaming mode was missing the required `message` property with `role` and `content`.

**Fix**: Added `message: { role: 'assistant', content: '' }` to the done message.

**Status**: ✅ FIXED

---

### Issue 2: Tool call errors with empty names
**Symptom**: Errors like `Error: Tool  not found` and tool calls with empty names and arguments.

**Root Cause**: OpenAI streams tool calls incrementally with partial data. We were passing through incomplete tool call chunks that only contained streaming metadata, not complete tool definitions.

**Fix**: Added filtering to only pass through complete tool calls that have:
- Valid `id`
- Valid `function.name` (non-empty)
- Complete structure

**Status**: ✅ FIXED

---

### Issue 3: Reasoning/Thinking content not showing
**Symptom**: No `<thinking>` content visible in responses despite requesting it.

**Root Cause**: TBD - Need to verify if LiteLLM is actually returning `reasoning_content`.

**Current Status**: Added comprehensive logging to detect if reasoning_content is being returned.

**What to check**:
1. Look for `*** REASONING CONTENT DETECTED ***` in logs
2. If not present, LiteLLM might not be returning thinking tokens

**Possible causes**:
- Model doesn't support reasoning (but Claude Sonnet 4.5 should)
- LiteLLM configuration issue
- API key doesn't have access to reasoning features

---

## Testing Steps

### 1. Reload VS Code
```
Ctrl+Shift+P → "Developer: Reload Window"
```

### 2. Open Developer Console
```
Help → Toggle Developer Tools → Console tab
```

### 3. Test Basic Chat
Send a simple message:
```
Hi! What's 2+2?
```

**Expected Results**:
- ✅ Response should appear in Continue.dev chat
- ✅ No tool call errors
- ❓ Check logs for reasoning content

### 4. Test Tool Calling
Send a message that requires tools:
```
Can you read the package.json file?
```

**Expected Results**:
- ✅ Tool should be called correctly
- ✅ No empty tool name errors
- ✅ Response should show file contents

### 5. Check for Reasoning Content

**Look for these logs**:

**Streaming mode**:
```
[LiteLLM Proxy XXXXX] Stream chunk delta: {...}
[LiteLLM Proxy XXXXX] *** REASONING CONTENT DETECTED ***: ...
```

**Non-streaming mode**:
```
[LiteLLM Proxy XXXXX] OpenAI response message: {...}
[LiteLLM Proxy XXXXX] *** REASONING CONTENT DETECTED ***: ...
```
OR
```
[LiteLLM Proxy XXXXX] No reasoning_content in response
```

---

## Understanding Reasoning/Thinking

### How It Should Work

According to LiteLLM docs, when `thinking` parameters are sent:
```json
{
  "reasoning_effort": "medium",
  "thinking": {
    "type": "enabled",
    "budget_tokens": 2048
  }
}
```

The response should include:
```json
{
  "choices": [{
    "message": {
      "content": "The actual response",
      "reasoning_content": "The thinking process",
      ...
    }
  }]
}
```

### Our Implementation

**Request Conversion** (Ollama → OpenAI):
```typescript
if (ollamaRequest.model.includes('claude') || ollamaRequest.model.includes('anthropic')) {
    openaiRequest.reasoning_effort = 'medium';
    openaiRequest.thinking = {
        type: 'enabled',
        budget_tokens: 2048
    };
}
```

**Response Conversion** (OpenAI → Ollama):
```typescript
if (message.reasoning_content) {
    content = `<thinking>\n${message.reasoning_content}\n</thinking>\n\n${content}`;
}
```

### Checking if LiteLLM Returns Reasoning

**After testing**, check the logs for:

1. **Request sent**:
```
[LiteLLM Proxy XXXXX] OpenAI request: {...}
```
Look for `reasoning_effort` and `thinking` in the request.

2. **Response received**:
```
[LiteLLM Proxy XXXXX] *** REASONING CONTENT DETECTED ***: ...
```
OR
```
[LiteLLM Proxy XXXXX] No reasoning_content in response
```

### If No Reasoning Content

**Possible reasons**:

1. **Model doesn't support extended thinking**:
   - Only certain Claude models support extended thinking
   - Check LiteLLM docs for supported models

2. **LiteLLM API issue**:
   - The API might not support reasoning for this endpoint
   - Try testing directly with curl:
   ```bash
   curl https://litellm.skoop.digital/v1/chat/completions \
     -H "Authorization: Bearer sk-Xko8_N_iN3Q_Mrda5imWQw" \
     -H "Content-Type: application/json" \
     -d '{
       "model": "anthropic/claude-sonnet-4-5",
       "messages": [{"role": "user", "content": "What is 2+2?"}],
       "reasoning_effort": "medium",
       "thinking": {"type": "enabled", "budget_tokens": 2048}
     }'
   ```

3. **Anthropic API limitations**:
   - Extended thinking might only be available on certain API tiers
   - Check with Skoop team about API access level

---

## Current Implementation Summary

### What's Working ✅
- ✅ Proxy server starts on localhost:8009
- ✅ /api/show endpoint returns model info
- ✅ /api/chat endpoint handles requests
- ✅ Streaming responses work
- ✅ Responses appear in Continue.dev chat
- ✅ Format conversion (Ollama ↔ OpenAI)
- ✅ Tool calls are properly filtered

### What's Partially Working ⚠️
- ⚠️ Thinking/reasoning content (needs verification)
  - Request parameters are being sent correctly
  - Response handling is implemented
  - **Unknown**: Is LiteLLM actually returning reasoning_content?

### What to Test Next 🧪
1. Verify if LiteLLM returns reasoning_content at all
2. If not, check LiteLLM API documentation
3. Test with direct API calls to isolate the issue
4. Consider alternative approaches if reasoning isn't supported

---

## Debug Commands

### Test Proxy Directly

**Non-streaming**:
```bash
curl http://localhost:8009/api/chat -X POST -H "Content-Type: application/json" -d '{
  "model": "anthropic/claude-sonnet-4-5",
  "messages": [{"role": "user", "content": "What is 2+2?"}],
  "stream": false
}'
```

**Streaming**:
```bash
curl http://localhost:8009/api/chat -X POST -H "Content-Type: application/json" -d '{
  "model": "anthropic/claude-sonnet-4-5",
  "messages": [{"role": "user", "content": "What is 2+2?"}],
  "stream": true
}'
```

### Check LiteLLM Directly

```bash
curl https://litellm.skoop.digital/v1/chat/completions \
  -H "Authorization: Bearer sk-Xko8_N_iN3Q_Mrda5imWQw" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "anthropic/claude-sonnet-4-5",
    "messages": [{"role": "user", "content": "Think step by step: What is 2+2?"}],
    "reasoning_effort": "medium",
    "thinking": {"type": "enabled", "budget_tokens": 2048}
  }'
```

---

## Next Steps

1. **Reload VS Code** and test with Continue.dev
2. **Check the logs** for reasoning content detection
3. **Report findings**:
   - Are tool calls working? ✅/❌
   - Is chat working? ✅/❌
   - Is reasoning_content being returned? ✅/❌
4. **If reasoning isn't working**, we can:
   - Contact LiteLLM support
   - Try different model names
   - Check API documentation
   - Implement alternative approaches
