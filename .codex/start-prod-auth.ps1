$env:Path = 'C:\Program Files\nodejs;' + $env:Path
$env:NODE_ENV = 'production'
$env:PORT = '3101'
$env:BASIC_AUTH_ENABLED = 'true'
$env:BASIC_AUTH_USERNAME = 'demo'
$env:BASIC_AUTH_PASSWORD = 'secret'
$env:HEALTHCHECK_BEARER_TOKEN = 'health-token'
Set-Location 'C:\codeX'
& 'C:\Program Files\nodejs\npm.cmd' run start:prod
