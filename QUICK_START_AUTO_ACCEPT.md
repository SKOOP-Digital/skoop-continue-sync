# Quick Start: Auto-Accept Continue.dev Actions

## 🎯 What This Does

Makes Continue.dev Agent mode execute **ALL** tool actions automatically without asking for permission (Accept/Reject prompts).

## ⚠️ WARNING

**THIS IS DANGEROUS!** All file edits, deletions, and terminal commands run automatically. Use only on:
- Non-critical code
- Personal projects
- Code with git backups

## 🚀 How to Use

### Enable Auto-Accept

**Option 1: Command Palette (Recommended)**
1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
2. Type: `Toggle Auto-Accept Continue.dev Dialogs`
3. Press Enter
4. Click "Reload Window" when prompted
5. ✅ Done! All Continue.dev tools now auto-execute

**Option 2: Settings UI**
1. Open Settings (`Ctrl+,`)
2. Search: `autoAcceptContinueDialogs`
3. Check the box
4. Reload window when prompted

### Disable Auto-Accept

Use either method above to toggle it off. Your original Continue.dev settings will be restored after reload.

## ✅ How to Verify It's Working

1. **Enable auto-accept** and reload VS Code
2. **Open Continue.dev** in Agent mode (sidebar)
3. **Ask it to edit a file**: "Add a comment to this file"
4. **Watch**: It should execute immediately without the "Accept/Reject" prompt

## 🔧 What Happens Behind the Scenes

When you enable auto-accept:
1. Extension modifies `~/.continue/index/globalContext.json`
2. Sets 14 tool policies to `"allowedWithoutPermission"`
3. Prompts you to reload VS Code
4. After reload, Continue.dev reads the new settings
5. All tool prompts are bypassed

When you disable:
1. Extension removes the modifications
2. Restores your original Continue.dev settings
3. Prompts you to reload VS Code

## 📍 Current Setting Status

Check the setting at any time:
- **VS Code Settings**: Search for `skoop-continue-sync.autoAcceptContinueDialogs`
- **Or run**: `Toggle Auto-Accept Continue.dev Dialogs` command to see current state

## 🆘 Troubleshooting

### Not Working After Enable?

1. **Did you reload?** Changes only take effect after reloading VS Code window
2. **Check the database**: Look at `~/.continue/index/globalContext.json` for `toolPolicies` section
3. **Check logs**: Open Developer Tools (`Help` → `Toggle Developer Tools`), check Console for `[Skoop Continue Sync]` messages

### Can't Find the Setting?

Make sure the Skoop Continue Sync extension is installed and enabled.

### Want to Manually Verify Database?

**Windows**: 
```powershell
Get-Content "$env:USERPROFILE\.continue\index\globalContext.json" | Select-String -Pattern "toolPolicies" -Context 5
```

**Mac/Linux**:
```bash
cat ~/.continue/index/globalContext.json | grep -A 15 toolPolicies
```

You should see all tools set to `"allowedWithoutPermission"`.

---

## 💡 Tips

- **Always commit your code** before enabling auto-accept
- **Start with simple tasks** to verify it's working
- **Disable when not needed** to avoid accidental actions
- **Use on personal projects** first before team projects

---

**For more details**, see [AUTO_ACCEPT_GUIDE.md](./AUTO_ACCEPT_GUIDE.md)
