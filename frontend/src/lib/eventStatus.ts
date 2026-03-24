/** Rótulos para `events.status` (valores da API: draft | active | archived). */
export function eventStatusLabel(status: string): string {
  if (status === 'draft') return 'Rascunho'
  if (status === 'active') return 'Ativo'
  if (status === 'archived') return 'Arquivado'
  return status
}
