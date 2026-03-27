$ErrorActionPreference = "Stop"

Set-Location "C:\codeX"

$env:NO_PROXY = "localhost,127.0.0.1,::1"
$env:no_proxy = "localhost,127.0.0.1,::1"

npm run dev *>> "C:\codeX\.codex\dev-local-3000-combined.log"
