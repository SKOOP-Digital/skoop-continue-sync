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

The Skoop extension **directly modifies Continue.dev's database** (`globalContext.json`) to set all tool policies to "allowedWithoutPermission". This bypasses the permission prompts at the source, making all tools execute automatically.

### Technical Implementation

1. **Database Modification**: Directly edits `~/.continue/index/globalContext.json`
2. **Tool Policies**: Sets all 14 tool policies to `"allowedWithoutPermission"`
3. **Backup & Restore**: Backs up original tool policies when enabled, restores them when disabled
4. **Window Reload**: Prompts to reload VS Code window for changes to take effect
5. **Clean Disable**: Completely removes modifications and restores original state when toggled off

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

**Important**: After enabling, you'll be prompted to reload VS Code. The setting **only takes effect after reloading**.

## How to Disable

Use any of the same methods above and:
- **Command Palette**: Run the toggle command again
- **Settings UI**: Uncheck the checkbox
- **settings.json**: Set to `false` or remove the setting

**Important**: After disabling, you'll be prompted to reload VS Code. Your original Continue.dev settings will be restored after reloading.

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

### Test 2: Verify Database Changes

1. Enable auto-accept
2. Check `~/.continue/index/globalContext.json`
3. Look for `"toolPolicies"` section with all tools set to `"allowedWithoutPermission"`
4. After reload, Continue.dev should execute all tools without prompting

### Test 3: Disable/Enable Toggle

1. Run toggle command → Should enable
2. Verify status message
3. Run toggle command again → Should disable
4. Verify status message

## Technical Details

### Modified Continue.dev Database Fields

When enabled, the extension modifies:

1. **toolPolicies**: Sets all tools to `"allowedWithoutPermission"`
   - read_file
   - edit_existing_file
   - create_new_file
   - ls
   - grep_search
   - file_glob_search
   - run_terminal_command
   - multi_edit
   - single_find_and_replace
   - view_diff
   - read_currently_open_file
   - codebase_search
   - list_dir
   - search_replace

2. **sharedConfig.autoAcceptEditToolDiffs**: Set to `true`

### Database Location

- **Windows**: `C:\Users\<username>\.continue\index\globalContext.json`
- **Mac/Linux**: `~/.continue/index/globalContext.json`

## Known Limitations

1. **Requires Window Reload**: Changes only take effect after reloading VS Code window
2. **No Undo for Actions**: There's no way to undo tool actions that were auto-executed
3. **Database Dependency**: Requires Continue.dev's `globalContext.json` to exist
4. **All or Nothing**: Either all tools are auto-accepted or none (no per-tool control)

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
| **Status** | Broken (not working) | ✅ Working |
| **Scope** | Only edit tool diffs | All tool prompts |
| **Official** | Official feature | Community workaround |
| **Safety** | Should be safer (edit-only) | More dangerous (all tools) |
| **Reliability** | Currently unreliable | ✅ Reliable (direct database modification) |
| **Reversible** | N/A (doesn't work) | ✅ Yes (completely reversible) |

---

**Last Updated**: September 29, 2025
**Extension Version**: 0.0.1
**Tested With**: Continue.dev (latest as of Sept 2025)
