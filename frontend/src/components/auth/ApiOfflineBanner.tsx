import { AlertTriangle } from 'lucide-react'
import { useEffect, useState } from 'react'

/**
 * Aviso quando o proxy Vite não consegue falar com o backend (502) ou a API está em baixo.
 */
export function ApiOfflineBanner() {
  const [state, setState] = useState<'checking' | 'ok' | 'offline'>('checking')

  useEffect(() => {
    let cancelled = false
    fetch('/api/health')
      .then((r) => {
        if (!cancelled) setState(r.ok ? 'ok' : 'offline')
      })
      .catch(() => {
        if (!cancelled) setState('offline')
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (state === 'checking' || state === 'ok') return null

  return (
    <div
      role="alert"
      className="mb-4 flex gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-950 dark:text-amber-100 text-pretty"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div>
        <p className="font-medium">API não está acessível (porta 3003)</p>
        <p className="mt-1 text-xs opacity-90">
          O frontend está a correr, mas o <strong className="font-semibold">backend</strong> não responde. Na{' '}
          <strong className="font-semibold">raiz do projeto</strong> execute{' '}
          <code className="rounded bg-black/10 px-1 py-0.5 dark:bg-white/10">npm run dev</code> (inicia API +
          UI) ou noutro terminal{' '}
          <code className="rounded bg-black/10 px-1 py-0.5 dark:bg-white/10">npm run dev:backend</code>.
        </p>
      </div>
    </div>
  )
}
