import { useMemo, useState } from 'react'
import { ClipboardList, Pencil, Wallet } from 'lucide-react'
import { SellSheetDialog } from '@/components/app/SellSheetDialog'
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
import type { SheetRow } from '@/context/EventWorkspaceContext'
import { useEventWorkspace } from '@/context/EventWorkspaceContext'
import { formatBRLFromCents } from '@/lib/formatMoney'
import { cn } from '@/lib/utils'

type Filter = 'all' | 'available' | 'sold'

function pendingForSheet(s: SheetRow): number {
  const price = s.sale_price_cents ?? 0
  const paid = s.amount_paid_cents ?? 0
  return Math.max(0, price - paid)
}

export default function EventSalesControlPage() {
  const { sheets, loadingSheets, loadSheets } = useEventWorkspace()
  const [filter, setFilter] = useState<Filter>('available')
  const [sellOpen, setSellOpen] = useState(false)
  const [sellTarget, setSellTarget] = useState<{ id: string; num: number } | null>(null)
  const [editSheet, setEditSheet] = useState<SheetRow | null>(null)

  const filtered = useMemo(() => {
    const active = sheets.filter((s) => s.sale_status !== 'cancelled')
    if (filter === 'available') return active.filter((s) => s.sale_status === 'available')
    if (filter === 'sold') return active.filter((s) => s.sale_status === 'sold')
    return active
  }, [sheets, filter])

  const soldSheets = useMemo(() => sheets.filter((s) => s.sale_status === 'sold'), [sheets])

  const totals = useMemo(() => {
    let received = 0
    let pending = 0
    for (const s of soldSheets) {
      received += s.amount_paid_cents ?? 0
      pending += pendingForSheet(s)
    }
    return { received, pending, count: soldSheets.length }
  }, [soldSheets])

  const filterBtn = (key: Filter, label: string) => (
    <Button
      key={key}
      type="button"
      size="sm"
      variant={filter === key ? 'default' : 'outline'}
      className={cn(filter === key && 'shadow-sm')}
      onClick={() => setFilter(key)}
    >
      {label}
    </Button>
  )

  const dialogEdit = editSheet
  const dialogId = dialogEdit?.id ?? sellTarget?.id ?? null
  const dialogNum = dialogEdit?.sheet_number ?? sellTarget?.num

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-border/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em caixa (recebido)</CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{formatBRLFromCents(totals.received)}</p>
            <p className="text-xs text-muted-foreground text-pretty">
              Soma do “Já recebido” nas folhas vendidas ({totals.count}).
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">A receber</CardTitle>
            <ClipboardList className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums text-amber-700 dark:text-amber-500">
              {formatBRLFromCents(totals.pending)}
            </p>
            <p className="text-xs text-muted-foreground text-pretty">
              Preço da folha menos o já recebido, por venda (só folhas vendidas com preço definido contam).
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/80 sm:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Resumo</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground text-pretty">
            Use preço e “Já recebido” em cada venda para acompanhar caixa e dívidas. Edite vendas já registadas com o
            lápis na tabela.
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Controle de vendas
          </CardTitle>
          <CardDescription className="text-pretty">
            Nome, contactos, endereço (CEP opcional via busca), vendedor e valores. Folhas canceladas geridas em{' '}
            <strong className="text-foreground">Folhas &amp; cartelas</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {filterBtn('available', 'Disponíveis para vender')}
          {filterBtn('sold', 'Já vendidas')}
          {filterBtn('all', 'Todas (exceto canceladas)')}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Folhas</CardTitle>
          <CardDescription>
            {loadingSheets ? 'A carregar…' : `${filtered.length} folha(s) neste filtro`}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Comprador</TableHead>
                <TableHead className="hidden lg:table-cell">WhatsApp</TableHead>
                <TableHead className="hidden xl:table-cell">Vendedor</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="text-right">Recebido</TableHead>
                <TableHead className="text-right">Falta</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    Nenhuma folha neste filtro.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.sheet_number}</TableCell>
                    <TableCell>
                      <Badge variant={s.sale_status === 'sold' ? 'success' : 'outline'}>
                        {s.sale_status === 'sold' ? 'Vendida' : 'Disponível'}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[140px] truncate text-sm">
                      {s.buyer_name ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="hidden max-w-[120px] truncate text-sm text-muted-foreground lg:table-cell">
                      {s.buyer_whatsapp ?? s.buyer_contact ?? '—'}
                    </TableCell>
                    <TableCell className="hidden max-w-[100px] truncate text-sm text-muted-foreground xl:table-cell">
                      {s.seller_name ?? '—'}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {formatBRLFromCents(s.sale_price_cents)}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {formatBRLFromCents(s.amount_paid_cents ?? 0)}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-amber-700 dark:text-amber-500">
                      {s.sale_status === 'sold' ? formatBRLFromCents(pendingForSheet(s)) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {s.sale_status === 'available' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setEditSheet(null)
                            setSellTarget({ id: s.id, num: s.sheet_number })
                            setSellOpen(true)
                          }}
                        >
                          Vincular comprador
                        </Button>
                      )}
                      {s.sale_status === 'sold' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => {
                            setSellTarget(null)
                            setEditSheet(s)
                            setSellOpen(true)
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Editar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <SellSheetDialog
        sheetId={dialogId}
        sheetNumber={dialogNum}
        open={sellOpen}
        editSheet={dialogEdit}
        onOpenChange={(v) => {
          setSellOpen(v)
          if (!v) {
            setSellTarget(null)
            setEditSheet(null)
          }
        }}
        onDone={() => void loadSheets()}
      />
    </div>
  )
}
