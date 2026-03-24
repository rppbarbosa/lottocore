#!/usr/bin/env bash
# Redirecionamento: o LottoCore corre no projeto Compose "lottocore", não em "-p root".
# Uso na VPS: /root/lottocore/scripts/deploy-vps.sh
# Este ficheiro mantém-se para não partir atalhos antigos.
set -euo pipefail
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/scripts/deploy-vps.sh"
