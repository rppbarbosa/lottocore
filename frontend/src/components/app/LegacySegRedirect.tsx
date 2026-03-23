import { Navigate, useParams } from 'react-router-dom'

/** Redireciona rotas antigas (cartelas, vendas, validacao) para as novas slugs. */
export function LegacySegRedirect({ to }: { to: string }) {
  const { eventId } = useParams<{ eventId: string }>()
  if (!eventId) return <Navigate to="/app/events" replace />
  return <Navigate to={`/app/events/${eventId}/${to}`} replace />
}
