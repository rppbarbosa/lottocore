<#
.SYNOPSIS
  Corre git pull + docker compose no servidor via SSH (a partir do Windows).

.EXAMPLE
  .\scripts\deploy-remote.ps1 -SshTarget root@203.0.113.10 -RemotePath /root/apps/lottocore

.EXAMPLE
  .\scripts\deploy-remote.ps1 -SshTarget ubuntu@vps.exemplo.pt -RemotePath /home/ubuntu/lottocore -IdentityFile $env:USERPROFILE\.ssh\id_ed25519

.NOTES
  - Requer OpenSSH (ssh) no PATH — incluído no Windows 10/11.
  - O utilizador SSH no servidor precisa de permissão para Docker.
  - Evite espaços em -RemotePath ou use aspas no PowerShell.
#>
param(
  [Parameter(Mandatory = $true)]
  [string] $SshTarget,

  [Parameter(Mandatory = $true)]
  [string] $RemotePath,

  [string] $IdentityFile = ''
)

$ErrorActionPreference = 'Stop'

# Caminho no remoto: aspas simples em bash (escapar ' como '\'' )
$escapedPath = $RemotePath.Replace("'", "'\''")
$bash = @"
set -e
export LC_DEPLOY_PATH='$escapedPath'
cd "`$LC_DEPLOY_PATH"
if [ ! -f .env ]; then
  echo 'ERRO: falta .env no diretorio do projeto.'
  exit 1
fi
git pull
docker compose build
docker compose up -d
docker compose ps
"@

$sshCmd = Get-Command ssh -ErrorAction SilentlyContinue
if (-not $sshCmd) {
  Write-Error 'Comando ssh nao encontrado. Ative OpenSSH Client em Definicoes > Aplicacoes > Funcionalidades opcionais.'
}

$argList = [System.Collections.ArrayList]::new()
if ($IdentityFile) {
  [void]$argList.Add('-i')
  [void]$argList.Add($IdentityFile)
}
[void]$argList.Add($SshTarget)
[void]$argList.Add('bash')
[void]$argList.Add('-s')

Write-Host "SSH: $SshTarget" -ForegroundColor Cyan
Write-Host "Path: $RemotePath" -ForegroundColor Cyan

$bash | & ssh @($argList.ToArray())
exit $LASTEXITCODE
