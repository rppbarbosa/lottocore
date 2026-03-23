import { useState } from 'react'
import { LayoutTemplate } from 'lucide-react'
import { EventPrintTemplateDialog } from '@/components/app/event/EventPrintTemplateDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useEventWorkspace } from '@/context/EventWorkspaceContext'

export default function EventSummaryPage() {
  const { rounds, setRoundStatus } = useEventWorkspace()
  const [templateOpen, setTemplateOpen] = useState(false)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Regras do jogo</CardTitle>
          <CardDescription>Referência rápida para a equipa no dia do evento.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground text-pretty">
            <li>5 rodadas por evento.</li>
            <li>Até 5 cartelas por folha (uma por rodada); na geração pode escolher menos cartelas por folha.</li>
            <li>Prémio automático apenas para cartela cheia; demais prémios são manuais.</li>
            <li>Fluxo: gerar folhas → vender → sortear → validar → jogador acompanha pelo QR.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rodadas</CardTitle>
          <CardDescription>Estado de cada rodada. Abra a rodada antes de sortear; feche quando terminar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3">
            {rounds.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">Rodada {r.round_number}</span>
                  <Badge variant={r.status === 'open' ? 'default' : 'secondary'}>{r.status}</Badge>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={r.status === 'pending'}
                    onClick={() => void setRoundStatus(r.id, 'pending')}
                  >
                    Pendente
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={r.status === 'open'}
                    onClick={() => void setRoundStatus(r.id, 'open')}
                  >
                    Abrir
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={r.status === 'closed'}
                    onClick={() => void setRoundStatus(r.id, 'closed')}
                  >
                    Fechar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
          <div className="space-y-1.5">
            <CardTitle>Modelo da folha (PDF)</CardTitle>
            <CardDescription className="text-pretty">
              Três imagens (fundo, topo, rodapé), textos opcionais e QR com fundo branco no PDF.
            </CardDescription>
          </div>
          <Button type="button" variant="secondary" className="shrink-0 gap-2" onClick={() => setTemplateOpen(true)}>
            <LayoutTemplate className="size-4" />
            Editar modelo
          </Button>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground text-pretty">
          <p>
            Guarde o modelo antes de gerar ou descarregar folhas para ver o resultado no PDF. A imagem de fundo só
            aparece na impressão (não na exportação PNG transparente).
          </p>
        </CardContent>
      </Card>

      <EventPrintTemplateDialog open={templateOpen} onOpenChange={setTemplateOpen} />

      <Card>
        <CardHeader>
          <CardTitle>Área pública</CardTitle>
          <CardDescription>Cada folha tem um link único (<code className="rounded bg-muted px-1">/f/…</code>) para o jogador conferir todas as rodadas.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground text-pretty">
          <p>
            Gere folhas em <strong>Gerar folhas</strong>. O QR no PDF e a coluna <strong>Link jogador</strong> em{' '}
            <strong>Folhas &amp; cartelas</strong> apontam para o mesmo URL no domínio da aplicação.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
