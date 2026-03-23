# Liberta a porta TCP (estado Listen) no Windows. Uso: .\scripts\free-port.ps1 3003
param(
  [Parameter(Position = 0)]
  [int]$Port = 3003
)
$ErrorActionPreference = 'SilentlyContinue'
$listeners = Get-NetTCPConnection -LocalPort $Port -State Listen
foreach ($c in $listeners) {
  $procId = $c.OwningProcess
  $p = Get-Process -Id $procId -ErrorAction SilentlyContinue
  $name = if ($p) { $p.ProcessName } else { '?' }
  Write-Host "[LottoCore] Porta $Port ocupada por PID $procId ($name) - a terminar..."
  Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
}
if ($listeners) {
  Start-Sleep -Milliseconds 500
}
