import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError, apiJson } from '@/lib/api'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (eventId: string) => void
}

export function CreateEventDialog({ open, onOpenChange, onCreated }: Props) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    const n = name.trim()
    if (!n) return
    setLoading(true)
    setErr(null)
    try {
      const data = await apiJson<{ event: { id: string } }>('/api/events', {
        method: 'POST',
        body: JSON.stringify({ name: n }),
      })
      setName('')
      onOpenChange(false)
      onCreated(data.event.id)
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Falha ao criar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo evento</DialogTitle>
          <DialogDescription>Cria o evento em rascunho com 5 rodadas.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-2">
          <Label htmlFor="ev-name">Nome</Label>
          <Input
            id="ev-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Bingo solidário 2025"
            maxLength={200}
          />
          {err && <p className="text-sm text-destructive">{err}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={submit} disabled={loading || !name.trim()}>
            {loading ? 'A criar…' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
