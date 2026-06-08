# Hands-off auto-commit setup

These watchers make commits **truly hands-off**: run once, and every file change
in the repo is automatically committed and pushed to GitHub. You never run a git
command manually again.

## 0. One-time prerequisites

1. Push the repo to GitHub once (see main `README.md`).
2. Make pushing password-free, otherwise auto-push can't authenticate. Easiest options:
   - **GitHub CLI:** install `gh`, then `gh auth login` (choose HTTPS). This stores credentials.
   - **or SSH remote:** `git remote set-url origin git@github.com:<you>/<repo>.git` with an SSH key added to GitHub.
   - **or a credential helper:** macOS `git config --global credential.helper osxkeychain`; Windows uses Git Credential Manager by default.

Test once manually: `git push`. If that works without prompting, the watcher will too.

## 1. macOS / Linux

```bash
cd <repo>
chmod +x scripts/autocommit.sh
./scripts/autocommit.sh
```

Leave the terminal open and it keeps syncing. To run it in the background:

```bash
nohup ./scripts/autocommit.sh >/tmp/oneman-autocommit.log 2>&1 &
```

### Start automatically at login (so it's ALWAYS on)

**Linux (cron):** `crontab -e` then add:
```
@reboot cd /full/path/to/repo && ./scripts/autocommit.sh >/tmp/oneman-autocommit.log 2>&1
```

**macOS (launchd):** create `~/Library/LaunchAgents/com.oneman.autocommit.plist`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.oneman.autocommit</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>/full/path/to/repo/scripts/autocommit.sh</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
</dict>
</plist>
```
Then: `launchctl load ~/Library/LaunchAgents/com.oneman.autocommit.plist`

## 2. Windows

```powershell
cd <repo>
powershell -ExecutionPolicy Bypass -File scripts\autocommit.ps1
```

### Start automatically at logon (Task Scheduler)
- Open **Task Scheduler -> Create Task**.
- **Trigger:** At log on.
- **Action:** Start a program -> `powershell.exe`
  Arguments: `-ExecutionPolicy Bypass -File "C:\full\path\to\repo\scripts\autocommit.ps1"`
- Check **Run whether user is logged on or not** if you want it fully background.

## How it works

Every few seconds it checks `git status`. If anything changed, it:
1. `git add -A`
2. commits with a timestamped message listing changed files
3. `git pull --rebase --autostash` (avoids conflicts), then `git push`

Default check interval is 10 seconds. Change it with `ONEMAN_INTERVAL` (bash) or
`-Interval` (PowerShell).

## The one honest caveat

The assistant that builds your updates cannot push to GitHub directly (no network
access from its sandbox). So the loop is: the assistant edits the modular files
and gives them to you -> you save them into this repo folder -> this watcher
instantly commits + pushes them. Once the files land in the folder, everything
else is automatic.
