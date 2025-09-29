# Testing the LiteLLM Proxy

## Steps to Test

### 1. Reload VS Code
Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac) and run:
```
Developer: Reload Window
```

Or simply close and reopen VS Code.

### 2. Check Proxy is Running
Open the Developer Console:
- `Help` → `Toggle Developer Tools`
- Click on the `Console` tab
- Look for: `[LiteLLM Proxy] Server listening on http://localhost:8009`

### 3. Open Continue.dev Chat
- Click on the Continue icon in the left sidebar
- Start a new chat session
- Make sure the model is set to `claude-sonnet-4-5` (or whatever model name you configured)

### 4. Send a Test Message
Try something like:
```
Hello! Can you help me understand this codebase?
```

### 5. Monitor the Logs
In the Developer Console, you should see:
- `[LiteLLM Proxy XXXXX] POST /api/show` - Continue checking model info
- `[LiteLLM Proxy XXXXX] POST /api/chat` - Your chat request
- `[LiteLLM Proxy XXXXX] Ollama request:` - The converted request
- `[LiteLLM Proxy XXXXX] OpenAI request:` - Forwarding to LiteLLM
- `[LiteLLM Proxy XXXXX] LiteLLM response status: 200` - Success!
- `[LiteLLM Proxy XXXXX] Ollama response:` - Converted response

### 6. Expected Behavior
- The response should appear in Continue.dev chat
- If the model uses reasoning, you should see thinking content in `<thinking>` tags
- Tool calls should work normally

## Troubleshooting

### Issue: Continue.dev not showing response

**Solution 1: Check Continue.dev Config**
Make sure your `~/.continue/config.yaml` has:
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

**Solution 2: Try with stream: true**
The issue might be with non-streaming responses. Try editing your Continue config to force streaming:
```yaml
models:
  - name: "claude-sonnet-4-5"
    provider: ollama
    model: anthropic/claude-sonnet-4-5
    apiBase: http://localhost:8009
    requestOptions:
      stream: true  # Add this
```

**Solution 3: Check for Continue.dev Errors**
In the Developer Console, filter by "continuedev" to see if there are any Continue-specific errors.

**Solution 4: Test Direct API Call**
Open a new terminal and test the proxy directly:
```bash
curl http://localhost:8009/api/chat -X POST -H "Content-Type: application/json" -d "{\"model\":\"anthropic/claude-sonnet-4-5\",\"messages\":[{\"role\":\"user\",\"content\":\"Hello\"}],\"stream\":false}"
```

You should see a JSON response. If this works but Continue.dev doesn't, there's an issue with Continue.dev's Ollama client.

### Issue: 404 errors on /api/show

This should now be fixed. If you still see 404s:
1. Make sure you reloaded VS Code
2. Check the compiled output exists: `out/extension.js`
3. The proxy server should show: `[LiteLLM Proxy XXXXX] Returning model info`

### Issue: "Connection refused"

The proxy server isn't running:
1. Check extension is activated
2. Look for activation errors in Developer Console
3. Try disabling and re-enabling the extension

### Issue: Empty responses

Check the LiteLLM API key is valid:
- Current key: `sk-Xko8_N_iN3Q_Mrda5imWQw`
- If expired, update `LITELLM_API_KEY` in `src/extension.ts`

## What the Logs Show

From your last test, I can see:
✅ Proxy started successfully
✅ Continue.dev connected to proxy
✅ `/api/show` endpoint was called (previously 404, now fixed)
✅ `/api/chat` request received
✅ Request converted to OpenAI format
✅ Forwarded to LiteLLM successfully
✅ Got 200 response from LiteLLM
✅ Response converted back to Ollama format
✅ Response sent back to Continue.dev

The proxy is working perfectly! If Continue.dev still isn't showing the response after reloading, the issue is likely in Continue.dev's Ollama client integration. Try the streaming option above or check if there's a Continue.dev update available.
