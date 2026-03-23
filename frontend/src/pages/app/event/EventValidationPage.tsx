import { useState } from 'react'
import { Trophy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useEventWorkspace } from '@/context/EventWorkspaceContext'

export default function EventValidationPage() {
  const { winners, confirmWin, dismissWin } = useEventWorkspace()
  const [confirmCard, setConfirmCard] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Vitórias
          </CardTitle>
          <CardDescription>
            Validação: deteção automática de cartela cheia; cartelas não vendidas não ganham. Confirme ou dispense
            cada sugestão.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Folha</TableHead>
                <TableHead>Token</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {winners.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Nenhuma vitória registada nesta rodada.
                  </TableCell>
                </TableRow>
              ) : (
                winners.map((w) => (
                  <TableRow key={w.card_id}>
                    <TableCell>{w.sheet_number}</TableCell>
                    <TableCell className="max-w-[140px] truncate font-mono text-xs">
                      {w.public_token}
                    </TableCell>
                    <TableCell>
                      <Badge variant={w.win_status === 'suggested' ? 'warning' : 'outline'}>
                        {w.win_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        {w.win_status === 'suggested' && (
                          <>
                            <Button size="sm" onClick={() => setConfirmCard(w.card_id)}>
                              Confirmar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void dismissWin(w.card_id)}
                            >
                              Dispensar
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!confirmCard} onOpenChange={(o) => !o && setConfirmCard(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar vitória?</DialogTitle>
            <DialogDescription>
              Esta ação marca a cartela como vitória confirmada pelo organizador.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmCard(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (confirmCard) void confirmWin(confirmCard).then(() => setConfirmCard(null))
              }}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
