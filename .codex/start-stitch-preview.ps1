$port = 3002
$workspace = "C:\codeX\.worktrees\stitch-preview"
$stdout = "C:\codeX\.codex\stitch-compare.log"
$stderr = "C:\codeX\.codex\stitch-compare-error.log"

$existing = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($existing) {
  Stop-Process -Id $existing.OwningProcess -Force
  Start-Sleep -Seconds 1
}

Remove-Item -ErrorAction SilentlyContinue $stdout, $stderr

Start-Process `
  -WindowStyle Hidden `
  -FilePath "npm.cmd" `
  -ArgumentList @("run", "start", "--", "--port", "$port") `
  -WorkingDirectory $workspace `
  -RedirectStandardOutput $stdout `
  -RedirectStandardError $stderr

Start-Sleep -Seconds 8
Invoke-WebRequest -UseBasicParsing "http://localhost:$port" | Select-Object -ExpandProperty StatusCode
