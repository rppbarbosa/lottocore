import { ChevronRight, Plus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CreateEventDialog } from '@/components/app/CreateEventDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ApiError, apiJson } from '@/lib/api'

type EventRow = {
  id: string
  name: string
  status: string
  created_at: string
}

export default function EventsPage() {
  const navigate = useNavigate()
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const data = await apiJson<{ events: EventRow[] }>('/api/events')
      setEvents(data.events)
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Erro ao carregar')
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const statusVariant = (s: string) => {
    if (s === 'active') return 'success' as const
    if (s === 'archived') return 'secondary' as const
    return 'outline' as const
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Eventos</h2>
          <p className="mt-1 text-sm text-muted-foreground text-pretty">
            Cada evento tem cinco rodadas. Abra um evento para gerir folhas, sorteio e vitórias.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Novo evento
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista</CardTitle>
          <CardDescription>
            {loading ? 'A carregar…' : `${events.length} evento(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {err && <p className="mb-4 text-sm text-destructive">{err}</p>}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="w-[100px]">Estado</TableHead>
                <TableHead className="w-[120px] text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    Nenhum evento. Crie o primeiro com o botão acima.
                  </TableCell>
                </TableRow>
              ) : (
                events.map((ev) => (
                  <TableRow key={ev.id}>
                    <TableCell className="font-medium">{ev.name}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(ev.status)}>{ev.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/app/events/${ev.id}`}>
                          Abrir
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CreateEventDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => {
          void load()
          navigate(`/app/events/${id}`)
        }}
      />
    </div>
  )
}
