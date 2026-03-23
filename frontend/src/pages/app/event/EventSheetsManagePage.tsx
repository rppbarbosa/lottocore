import { Download, Eye, FolderArchive, Layers } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  BULK_PDF_ZIP_LOADING,
  type BulkSheetExportFormat,
  useEventWorkspace,
} from '@/context/EventWorkspaceContext'
import { ApiError, apiJson } from '@/lib/api'
import { parseSheetRangeInput } from '@/lib/sheetRange'
import { cn } from '@/lib/utils'

type Filter = 'all' | 'available' | 'sold' | 'cancelled'

function statusBadge(status: string) {
  if (status === 'sold') return <Badge variant="success">Vendida</Badge>
  if (status === 'cancelled') return <Badge variant="destructive">Cancelada</Badge>
  return <Badge variant="outline">Disponível</Badge>
}

export default function EventSheetsManagePage() {
  const {
    sheets,
    loadingSheets,
    loadSheets,
    pdfLoading,
    downloadPdf,
    previewPdf,
    downloadRaster,
    downloadBulkPdfsZip,
    setActionErr,
  } = useEventWorkspace()
  const [filter, setFilter] = useState<Filter>('all')
  const [confirmCancel, setConfirmCancel] = useState<{ id: string; num: number } | null>(null)
  const [rangeInput, setRangeInput] = useState('')
  const [bulkExportFormat, setBulkExportFormat] = useState<BulkSheetExportFormat>('pdf')

  const bulkBusy = pdfLoading === BULK_PDF_ZIP_LOADING
  const anyPdfBusy = pdfLoading != null

  const filtered = useMemo(() => {
    if (filter === 'available') return sheets.filter((s) => s.sale_status === 'available')
    if (filter === 'sold') return sheets.filter((s) => s.sale_status === 'sold')
    if (filter === 'cancelled') return sheets.filter((s) => s.sale_status === 'cancelled')
    return sheets
  }, [sheets, filter])

  const doCancel = async () => {
    if (!confirmCancel) return
    setActionErr(null)
    try {
      await apiJson(`/api/sheets/${confirmCancel.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ sale_status: 'cancelled' }),
      })
      setConfirmCancel(null)
      void loadSheets()
    } catch (e) {
      setActionErr(e instanceof ApiError ? e.message : 'Não foi possível cancelar')
    }
  }

  const doReactivate = async (sheetId: string) => {
    setActionErr(null)
    try {
      await apiJson(`/api/sheets/${sheetId}`, {
        method: 'PATCH',
        body: JSON.stringify({ sale_status: 'available' }),
      })
      void loadSheets()
    } catch (e) {
      setActionErr(e instanceof ApiError ? e.message : 'Não foi possível reativar')
    }
  }

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

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Folhas e cartelas criadas
          </CardTitle>
          <CardDescription className="text-pretty">
            Consulte estado (disponível, vendida, cancelada), visualize ou descarregue PDF, PNG ou JPEG. O jogador
            usa um único QR por folha (<code className="rounded bg-muted px-1">/f/…</code>). Folhas canceladas
            deixam de ser acessíveis publicamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {filterBtn('all', 'Todas')}
          {filterBtn('available', 'Disponíveis')}
          {filterBtn('sold', 'Vendidas')}
          {filterBtn('cancelled', 'Canceladas')}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderArchive className="h-5 w-5 text-primary" />
            Exportar folhas (ZIP)
          </CardTitle>
          <CardDescription className="text-pretty">
            Descarregar várias folhas de uma vez em PDF, JPEG (bom para impressão em massa) ou PNG. Escolha o formato
            abaixo; os ficheiros no ZIP usam o prefixo <span className="font-mono">bingo-folha-NNNN</span> com a
            extensão correspondente. O servidor valida o ZIP antes de enviar, para reduzir ficheiros truncados. Pode
            demorar.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex min-w-0 flex-col gap-2 sm:w-44">
            <Label htmlFor="bulk-export-format">Formato no ZIP</Label>
            <select
              id="bulk-export-format"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={bulkExportFormat}
              onChange={(e) => setBulkExportFormat(e.target.value as BulkSheetExportFormat)}
              disabled={bulkBusy}
            >
              <option value="pdf">PDF</option>
              <option value="jpeg">JPEG (impressão)</option>
              <option value="png">PNG</option>
            </select>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="gap-2"
            disabled={bulkBusy || loadingSheets || sheets.length === 0}
            onClick={() => void downloadBulkPdfsZip({ all: true, format: bulkExportFormat })}
          >
            <FolderArchive className="h-4 w-4" />
            {bulkBusy ? 'A gerar ZIP…' : 'Todas as folhas (ZIP)'}
          </Button>
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:max-w-xs">
            <Label htmlFor="sheet-range-zip">Intervalo (nº da folha)</Label>
            <Input
              id="sheet-range-zip"
              placeholder="ex.: 7-23 ou 15"
              value={rangeInput}
              onChange={(e) => setRangeInput(e.target.value)}
              disabled={bulkBusy}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={bulkBusy || loadingSheets}
            onClick={() => {
              const r = parseSheetRangeInput(rangeInput)
              if (!r) {
                setActionErr('Intervalo inválido. Use dois números separados por hífen (ex.: 7-23) ou um só número.')
                return
              }
              setActionErr(null)
              void downloadBulkPdfsZip({ ...r, format: bulkExportFormat })
            }}
          >
            Intervalo (ZIP)
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Listagem</CardTitle>
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
                <TableHead>Cartelas</TableHead>
                <TableHead>Comprador</TableHead>
                <TableHead className="min-w-[140px]">Link jogador</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Nenhuma folha neste filtro.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.sheet_number}</TableCell>
                    <TableCell>{statusBadge(s.sale_status)}</TableCell>
                    <TableCell className="tabular-nums">{s.card_count}</TableCell>
                    <TableCell className="max-w-[180px] truncate text-sm text-muted-foreground">
                      {s.sale_status === 'sold' ? (s.buyer_name ?? '—') : '—'}
                    </TableCell>
                    <TableCell className="align-top text-xs">
                      <a
                        className="break-all text-primary underline-offset-4 hover:underline"
                        href={`/f/${encodeURIComponent(s.public_token)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        /f/{s.public_token}
                      </a>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={anyPdfBusy && pdfLoading !== s.id}
                          title="Abrir PDF num novo separador"
                          onClick={() => void previewPdf(s.id)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Ver PDF
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={anyPdfBusy && pdfLoading !== s.id}
                          title="Descarregar ficheiro"
                          onClick={() => void downloadPdf(s.id)}
                        >
                          <Download className="h-3.5 w-3.5" />
                          PDF
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={anyPdfBusy && pdfLoading !== s.id}
                          title="PNG retrato: transparente fora da grelha; QR único da folha em baixo"
                          onClick={() => void downloadRaster(s.id, 'png')}
                        >
                          PNG
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={anyPdfBusy && pdfLoading !== s.id}
                          title="JPEG retrato: fundo branco; grelhas opacas e QR único da folha"
                          onClick={() => void downloadRaster(s.id, 'jpeg')}
                        >
                          JPEG
                        </Button>
                        {(s.sale_status === 'available' || s.sale_status === 'sold') && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setConfirmCancel({ id: s.id, num: s.sheet_number })}
                          >
                            Cancelar folha
                          </Button>
                        )}
                        {s.sale_status === 'cancelled' && (
                          <Button variant="outline" size="sm" onClick={() => void doReactivate(s.id)}>
                            Reativar
                          </Button>
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

      <Dialog open={!!confirmCancel} onOpenChange={(o) => !o && setConfirmCancel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar folha #{confirmCancel?.num}?</DialogTitle>
            <DialogDescription>
              A folha fica como cancelada; dados de comprador são removidos. Cartelas deixam de ser válidas na
              página pública até reativar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmCancel(null)}>
              Não
            </Button>
            <Button variant="destructive" onClick={() => void doCancel()}>
              Sim, cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
