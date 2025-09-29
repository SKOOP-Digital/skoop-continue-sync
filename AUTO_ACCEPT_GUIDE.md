# Auto-Accept Continue.dev Dialogs

## Overview

This feature enables your Skoop Continue Sync extension to automatically accept all Continue.dev tool prompts without manual intervention. This is a **workaround** for the broken `autoAcceptEditToolDiffs` setting in Continue.dev.

## ⚠️ WARNING

**This is a DANGEROUS feature!** When enabled:
- All Continue.dev tool actions will execute automatically without asking for permission
- File edits, deletions, and terminal commands will run without review
- There is NO undo or safety net
- Use only in controlled environments or on non-critical code

## How It Works

The Skoop extension intercepts VS Code's dialog system (specifically `showInformationMessage` and `showWarningMessage`) and automatically returns an "Accept" response when it detects a Continue.dev prompt. This effectively bypasses all Continue.dev permission requests.

### Technical Implementation

1. **Dialog Interception**: Monkey patches `vscode.window.showInformationMessage` and `showWarningMessage`
2. **Pattern Matching**: Identifies Continue.dev prompts by checking for keywords like "tool", "accept", "reject", "agent", "edit", etc.
3. **Automatic Response**: Returns the first "accept-like" action (Accept, OK, Yes, Apply, Continue, Confirm, Allow)
4. **Fallback**: If no explicit accept action is found, returns the first available option

## How to Enable

### Method 1: Via Command Palette (Recommended)

1. Open Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
2. Type: `Toggle Auto-Accept Continue.dev Dialogs`
3. Select the command
4. You'll see a confirmation message indicating the feature is enabled

### Method 2: Via Settings

1. Open VS Code Settings (`Ctrl+,` or `Cmd+,`)
2. Search for: `skoop-continue-sync.autoAcceptContinueDialogs`
3. Check the checkbox to enable
4. A warning notification will appear

### Method 3: Via settings.json

Add this to your User settings (`.vscode/settings.json` or global settings):

```json
{
  "skoop-continue-sync.autoAcceptContinueDialogs": true
}
```

## How to Disable

Use any of the same methods above and:
- **Command Palette**: Run the toggle command again
- **Settings UI**: Uncheck the checkbox
- **settings.json**: Set to `false` or remove the setting

## Usage Tips

### Safe Usage

1. **Test First**: Enable auto-accept on a test project with non-critical code
2. **Review After**: Manually review all changes after auto-accept runs
3. **Version Control**: Always commit your work before using auto-accept
4. **Disable When Done**: Turn off auto-accept when not actively using Agent mode

### When to Use

✅ **Good scenarios:**
- Rapid prototyping on throwaway code
- Testing Continue.dev configurations
- Automating repetitive agent tasks
- Working on personal projects with full git backups

❌ **Bad scenarios:**
- Production code without review
- Shared repositories without team agreement
- Critical system files
- Any code you can't easily restore

## Troubleshooting

### Auto-Accept Not Working

1. **Check if enabled**: Run the toggle command and verify the status message
2. **Check console**: Open Developer Tools (`Help` → `Toggle Developer Tools`) and check the Console tab for `[Skoop Continue Sync]` log messages
3. **Pattern mismatch**: Some Continue.dev prompts might not match the detection patterns. Check the console to see if the dialog was detected.
4. **Continue.dev using custom UI**: If Continue.dev uses webviews instead of VS Code dialogs, this feature won't work

### Too Many Dialogs Auto-Accepting

The pattern matching might be too broad. If non-Continue.dev dialogs are being auto-accepted:

1. Disable auto-accept immediately
2. Report the issue with examples of which dialogs were incorrectly auto-accepted
3. We can refine the pattern matching logic

### Extension Conflicts

If other extensions show dialogs that get auto-accepted:

1. The current implementation tries to detect Continue.dev patterns specifically
2. Report any false positives so we can improve the detection logic

## How to Test

### Test 1: Basic Functionality

1. Enable auto-accept
2. Open Continue.dev in Agent mode
3. Ask it to edit a file: `"Please add a comment to this file"`
4. Observe: The tool should execute without prompting you

### Test 2: Verify Logging

1. Open Developer Tools (`Help` → `Toggle Developer Tools`)
2. Go to Console tab
3. Enable auto-accept
4. You should see: `[Skoop Continue Sync] Auto-accept enabled successfully`
5. Trigger a Continue.dev action
6. Look for: `[Skoop Continue Sync] Auto-accepting dialog: ...`

### Test 3: Disable/Enable Toggle

1. Run toggle command → Should enable
2. Verify status message
3. Run toggle command again → Should disable
4. Verify status message

## Technical Details

### Dialog Detection Patterns

The following regex patterns are used to identify Continue.dev prompts:

```typescript
/continue/i
/tool/i
/accept/i
/reject/i
/agent/i
/edit/i
/apply/i
/changes/i
/diff/i
/file/i
/terminal/i
/command/i
/run/i
```

If a dialog message matches ANY of these patterns, it will be auto-accepted.

### Accept Action Matching

The following button/action labels are considered "accept" actions:

- Accept
- OK
- Yes
- Apply
- Continue
- Confirm
- Allow

If none of these are found, the first action is chosen by default.

## Known Limitations

1. **Webview Dialogs**: Only works for VS Code native dialogs, not custom webviews
2. **Pattern Matching**: May have false positives/negatives depending on dialog text
3. **No Undo**: There's no way to undo auto-accepted actions
4. **Extension Restart**: Requires extension reload if the feature was enabled before extension activation

## Feedback and Issues

If you encounter issues or have suggestions:

1. Check the Developer Console for error messages
2. Note which Continue.dev actions worked/didn't work with auto-accept
3. Report the issue with:
   - The exact Continue.dev prompt text (from console logs)
   - Expected vs actual behavior
   - VS Code and Continue.dev versions

## Alternative Solutions

While you're using this workaround, also:

1. **File a bug with Continue.dev**: Report that `autoAcceptEditToolDiffs: true` isn't working
2. **Check for updates**: Continue.dev may fix the issue in newer versions
3. **Monitor GitHub**: Watch https://github.com/continuedev/continue/issues for related issues

## Comparison with Continue.dev's Built-in Setting

| Feature | Continue.dev `autoAcceptEditToolDiffs` | Skoop Auto-Accept |
|---------|--------------------------------------|-------------------|
| **Status** | Broken (not working) | Working workaround |
| **Scope** | Only edit tool diffs | All tool prompts |
| **Official** | Official feature | Community workaround |
| **Safety** | Should be safer (edit-only) | More dangerous (all tools) |
| **Reliability** | Currently unreliable | Reliable but hacky |

---

**Last Updated**: September 29, 2025
**Extension Version**: 0.0.1
**Tested With**: Continue.dev (latest as of Sept 2025)
