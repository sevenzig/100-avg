# Windows PowerShell SCP Guide

## Copying Files from Windows to Linux Server

### Prerequisites

1. **OpenSSH Client** (usually pre-installed on Windows 10/11)
   - Check if installed: `Get-WindowsCapability -Online | Where-Object Name -like 'OpenSSH*'`
   - Install if needed: `Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0`

2. **SSH Access** to your server
   - You should be able to SSH into the server: `ssh user@your-server`

### Basic SCP Command (PowerShell)

```powershell
# From your project directory
scp .\database\wingspan.db user@your-server:/tmp/wingspan.db
```

**Important Notes:**
- Use **backslashes** (`\`) for Windows paths, or forward slashes (`/`) work too
- Use **forward slashes** (`/`) for Linux paths
- Replace `user@your-server` with your actual credentials

### Examples

#### Example 1: Basic Copy
```powershell
# Navigate to project directory
cd C:\Users\scootypuffjr\Projects\wingspan-score

# Copy database file
scp .\database\wingspan.db scott@100avg.phelddagrif.farm:/tmp/wingspan.db
```

#### Example 2: With Full Path
```powershell
scp C:\Users\scootypuffjr\Projects\wingspan-score\database\wingspan.db scott@100avg.phelddagrif.farm:/tmp/wingspan.db
```

#### Example 3: Using Forward Slashes (also works)
```powershell
scp ./database/wingspan.db scott@100avg.phelddagrif.farm:/tmp/wingspan.db
```

### Authentication

#### Using Password
```powershell
# You'll be prompted for password
scp .\database\wingspan.db user@server:/tmp/wingspan.db
```

#### Using SSH Key (Recommended)
```powershell
# If you have SSH key set up, it will use it automatically
scp .\database\wingspan.db user@server:/tmp/wingspan.db

# Or specify key explicitly
scp -i C:\Users\scootypuffjr\.ssh\id_rsa .\database\wingspan.db user@server:/tmp/wingspan.db
```

### Common Issues and Solutions

#### Issue: "scp: command not found"
**Solution:** Install OpenSSH Client
```powershell
Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0
```

#### Issue: "Permission denied"
**Solutions:**
1. Check SSH key permissions: `icacls C:\Users\scootypuffjr\.ssh\id_rsa`
2. Use password authentication if key isn't working
3. Verify username and server address

#### Issue: "Host key verification failed"
**Solution:** Remove old host key
```powershell
ssh-keygen -R your-server
```

### Alternative Methods

#### Method 1: WinSCP (GUI Tool)
1. Download WinSCP: https://winscp.net/
2. Connect to your server
3. Drag and drop the file

#### Method 2: PowerShell SSH Module (Posh-SSH)
```powershell
# Install module
Install-Module -Name Posh-SSH

# Copy file
$session = New-SSHSession -ComputerName your-server -Credential (Get-Credential)
Set-SCPFile -SessionId $session.SessionId -LocalFile .\database\wingspan.db -RemotePath /tmp/wingspan.db
```

#### Method 3: Manual Upload via Dokploy UI
1. Use Dokploy's file manager (if available)
2. Upload directly through the web interface

### Complete Workflow Example

```powershell
# 1. Navigate to project
cd C:\Users\scootypuffjr\Projects\wingspan-score

# 2. Verify database exists
Test-Path .\database\wingspan.db

# 3. Copy to server
scp .\database\wingspan.db scott@100avg.phelddagrif.farm:/tmp/wingspan.db

# 4. SSH into server to move/copy to final location
ssh scott@100avg.phelddagrif.farm
# Then on server:
# sudo cp /tmp/wingspan.db /home/scott/databases/wingspan.db
# sudo chown 1001:1001 /home/scott/databases/wingspan.db
```

### Quick Reference

| Task | PowerShell Command |
|------|---------------------|
| Copy file | `scp .\file.txt user@server:/path/` |
| Copy directory | `scp -r .\folder user@server:/path/` |
| Specify port | `scp -P 2222 .\file.txt user@server:/path/` |
| Use SSH key | `scp -i ~\.ssh\id_rsa .\file.txt user@server:/path/` |
| Verbose output | `scp -v .\file.txt user@server:/path/` |

---

**For your specific case:**
```powershell
# Replace with your actual server details
scp .\database\wingspan.db scott@your-server-ip-or-domain:/tmp/wingspan.db
```
