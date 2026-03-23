import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
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
import { PrintTemplateSheetPreview } from '@/components/app/event/PrintTemplateSheetPreview'
import {
  type EventPrintSettings,
  type PrintSettingsSavePayload,
  useEventWorkspace,
} from '@/context/EventWorkspaceContext'
import { imageFileToPrintDataUrl } from '@/lib/compressImageToDataUrl'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'

/** Largura/altura úteis no PDF (A4 com margens 8 mm — alinhado ao gerador). */
const PDF_MM = { w: 194, h: 281 } as const
/** Largura da faixa do cabeçalho no PDF (sangria, largura total do A4). */
const HEADER_PDF_WIDTH_MM = 210
/** Altura máxima da imagem do topo no PDF (faixa mais alta = menos espaço vazio até às cartelas). */
const HEADER_MAX_MM_H = 70
/** Rodapé: altura máx. da imagem no PDF (proporção mantida). */
const FOOTER_MAX_MM_H = 48

function mmToPx(mm: number, dpi: number) {
  return Math.round((mm / 25.4) * dpi)
}

function ImageSizeHint({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-muted/45 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground text-pretty">
      {children}
    </div>
  )
}

type LocalForm = {
  backgroundImageDataUrl: string | null
  bgOpacityPct: number
  headerImageDataUrl: string | null
  footerImageDataUrl: string | null
  subtitle: string
  footerNote: string
}

function opacityToPercent(opacity: number | null | undefined): number {
  if (opacity == null || !Number.isFinite(opacity)) return 18
  const n = opacity > 1 ? opacity : opacity * 100
  return Math.round(Math.min(50, Math.max(5, n)))
}

function isDataUrl(s: string | null | undefined): boolean {
  return typeof s === 'string' && s.startsWith('data:image/')
}

/** Só preenche data URLs inline (legado); imagens em disco vêm do GET /print-settings/file. */
function settingsToForm(ps: EventPrintSettings): LocalForm {
  return {
    backgroundImageDataUrl: isDataUrl(ps.backgroundImageDataUrl) ? (ps.backgroundImageDataUrl ?? null) : null,
    bgOpacityPct: opacityToPercent(ps.backgroundOpacity ?? null),
    headerImageDataUrl: isDataUrl(ps.headerImageDataUrl) ? (ps.headerImageDataUrl ?? null) : null,
    footerImageDataUrl: isDataUrl(ps.footerImageDataUrl) ? (ps.footerImageDataUrl ?? null) : null,
    subtitle: ps.subtitle ?? '',
    footerNote: ps.footerNote ?? '',
  }
}

type SlotName = 'background' | 'header' | 'footer'

function emptySlotDirty() {
  return { background: false, header: false, footer: false }
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EventPrintTemplateDialog({ open, onOpenChange }: Props) {
  const { printSettings, savePrintSettings, eventId } = useEventWorkspace()
  const bgInputRef = useRef<HTMLInputElement>(null)
  const headerInputRef = useRef<HTMLInputElement>(null)
  const footerImgInputRef = useRef<HTMLInputElement>(null)
  const blobUrlsRef = useRef<string[]>([])
  const initialHadRef = useRef({ background: false, header: false, footer: false })
  const [form, setForm] = useState<LocalForm>(() => settingsToForm({}))
  const [slotDirty, setSlotDirty] = useState(emptySlotDirty)
  const [saving, setSaving] = useState(false)
  const [localErr, setLocalErr] = useState<string | null>(null)
  const baseId = useId()

  const revokeBlobUrls = useCallback(() => {
    blobUrlsRef.current.forEach((u) => URL.revokeObjectURL(u))
    blobUrlsRef.current = []
  }, [])

  useEffect(() => {
    if (!open) {
      revokeBlobUrls()
      return
    }
    initialHadRef.current = {
      background: !!(
        printSettings.hasBackgroundImage || isDataUrl(printSettings.backgroundImageDataUrl)
      ),
      header: !!(printSettings.hasHeaderImage || isDataUrl(printSettings.headerImageDataUrl)),
      footer: !!(printSettings.hasFooterImage || isDataUrl(printSettings.footerImageDataUrl)),
    }
    setSlotDirty(emptySlotDirty())
    setForm(settingsToForm(printSettings))
    setLocalErr(null)

    let cancelled = false
    async function loadSlot(slot: SlotName) {
      const need =
        slot === 'background'
          ? printSettings.hasBackgroundImage && !isDataUrl(printSettings.backgroundImageDataUrl)
          : slot === 'header'
            ? printSettings.hasHeaderImage && !isDataUrl(printSettings.headerImageDataUrl)
            : printSettings.hasFooterImage && !isDataUrl(printSettings.footerImageDataUrl)
      if (!need) return null
      const res = await apiFetch(`/api/events/${eventId}/print-settings/file/${slot}`)
      if (!res.ok) return null
      const blob = await res.blob()
      return URL.createObjectURL(blob)
    }

    void (async () => {
      const created: string[] = []
      try {
        const entries: { slot: SlotName; key: keyof LocalForm }[] = [
          { slot: 'background', key: 'backgroundImageDataUrl' },
          { slot: 'header', key: 'headerImageDataUrl' },
          { slot: 'footer', key: 'footerImageDataUrl' },
        ]
        const updates: Partial<LocalForm> = {}
        for (const { slot, key } of entries) {
          const url = await loadSlot(slot)
          if (url) {
            created.push(url)
            ;(updates as Record<string, string>)[key] = url
          }
        }
        if (cancelled) {
          created.forEach((u) => URL.revokeObjectURL(u))
          return
        }
        blobUrlsRef.current = created
        if (Object.keys(updates).length) {
          setForm((f) => ({ ...f, ...updates }))
        }
      } catch {
        if (!cancelled) created.forEach((u) => URL.revokeObjectURL(u))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, printSettings, eventId, revokeBlobUrls])

  const onPickBackground = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try {
      const url = await imageFileToPrintDataUrl(f)
      setSlotDirty((d) => ({ ...d, background: true }))
      setForm((s) => ({ ...s, backgroundImageDataUrl: url }))
      setLocalErr(null)
    } catch (err) {
      setLocalErr(err instanceof Error ? err.message : 'Erro ao carregar imagem')
    }
  }, [])

  const onPickHeader = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try {
      const url = await imageFileToPrintDataUrl(f)
      setSlotDirty((d) => ({ ...d, header: true }))
      setForm((s) => ({ ...s, headerImageDataUrl: url }))
      setLocalErr(null)
    } catch (err) {
      setLocalErr(err instanceof Error ? err.message : 'Erro ao carregar imagem')
    }
  }, [])

  const onPickFooterImage = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try {
      const url = await imageFileToPrintDataUrl(f)
      setSlotDirty((d) => ({ ...d, footer: true }))
      setForm((s) => ({ ...s, footerImageDataUrl: url }))
      setLocalErr(null)
    } catch (err) {
      setLocalErr(err instanceof Error ? err.message : 'Erro ao carregar imagem')
    }
  }, [])

  const handleSave = async () => {
    setLocalErr(null)
    setSaving(true)
    try {
      const ih = initialHadRef.current
      const payload: PrintSettingsSavePayload = {
        subtitle: form.subtitle.trim() ? form.subtitle.trim() : null,
        footerNote: form.footerNote.trim() ? form.footerNote.trim() : null,
        backgroundOpacity: form.backgroundImageDataUrl != null ? form.bgOpacityPct / 100 : null,
      }

      if (!slotDirty.background) {
        if (ih.background) payload.keepBackgroundImage = true
      } else if (form.backgroundImageDataUrl == null) {
        payload.backgroundImageDataUrl = null
      } else if (isDataUrl(form.backgroundImageDataUrl)) {
        payload.backgroundImageDataUrl = form.backgroundImageDataUrl
      } else {
        payload.keepBackgroundImage = true
      }

      if (!slotDirty.header) {
        if (ih.header) payload.keepHeaderImage = true
      } else if (form.headerImageDataUrl == null) {
        payload.headerImageDataUrl = null
      } else if (isDataUrl(form.headerImageDataUrl)) {
        payload.headerImageDataUrl = form.headerImageDataUrl
      } else {
        payload.keepHeaderImage = true
      }

      if (!slotDirty.footer) {
        if (ih.footer) payload.keepFooterImage = true
      } else if (form.footerImageDataUrl == null) {
        payload.footerImageDataUrl = null
      } else if (isDataUrl(form.footerImageDataUrl)) {
        payload.footerImageDataUrl = form.footerImageDataUrl
      } else {
        payload.keepFooterImage = true
      }

      await savePrintSettings(payload)
      onOpenChange(false)
    } catch {
      /* actionErr já definido no contexto */
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(92vh,800px)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modelo da folha (PDF)</DialogTitle>
          <DialogDescription className="text-pretty">
            Três imagens opcionais: fundo (marca d&apos;água), topo e rodapé; mais textos. Ficheiros grandes são
            comprimidos automaticamente no navegador. No PDF, a marca d&apos;água sangra em toda a folha A4; a
            imagem do topo usa largura total (210 mm) e até ~{HEADER_MAX_MM_H} mm de altura; o rodapé, largura
            total com altura indicada na secção de rodapé. O selo Nº fica por cima no canto superior direito.
            Cartelas mantêm recuo interior. O QR tem fundo branco.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 text-sm">
          {(localErr || null) && (
            <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-destructive">
              {localErr}
            </p>
          )}

          <div className="rounded-lg border bg-muted/20 p-4">
            <PrintTemplateSheetPreview form={form} />
          </div>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Imagem de fundo (marca d&apos;água)</h3>
            <p className="text-xs text-muted-foreground text-pretty">
              No PDF cobre toda a página até às bordas (sangria); use opacidade baixa para não atrapalhar a leitura.
            </p>
            <ImageSizeHint>
              <p className="m-0">
                Para cobrir a página inteira no PDF (sangria):{' '}
                <strong className="text-foreground">≈ 21,0 × 29,7 cm</strong> (A4). Referência da área só de
                conteúdo (com margem interna):{' '}
                <strong className="text-foreground">
                  ≈ 19,4 × 28,1 cm
                </strong>{' '}
                ({PDF_MM.w} × {PDF_MM.h} mm). Em pixels:{' '}
                <strong className="text-foreground">
                  ≈ {mmToPx(PDF_MM.w, 300)} × {mmToPx(PDF_MM.h, 300)} px a 300 ppp
                </strong>{' '}
                (impressão nítida) ou{' '}
                <strong className="text-foreground">
                  ≈ {mmToPx(PDF_MM.w, 150)} × {mmToPx(PDF_MM.h, 150)} px a 150 ppp
                </strong>{' '}
                (ficheiros mais pequenos). O PDF ajusta com <span className="font-mono text-[10px]">cover</span> —
                outras proporções podem ser cortadas nas bordas. Imagens grandes são otimizadas automaticamente
                (JPEG) no navegador.
              </p>
            </ImageSizeHint>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={bgInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                id={`${baseId}-bg`}
                onChange={onPickBackground}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => bgInputRef.current?.click()}>
                Escolher imagem
              </Button>
              {form.backgroundImageDataUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => {
                    setSlotDirty((d) => ({ ...d, background: true }))
                    setForm((s) => ({ ...s, backgroundImageDataUrl: null }))
                  }}
                >
                  Remover
                </Button>
              ) : null}
            </div>
            {form.backgroundImageDataUrl ? (
              <>
                <div className="relative overflow-hidden rounded-md border bg-muted/30">
                  <img
                    src={form.backgroundImageDataUrl}
                    alt=""
                    className="mx-auto max-h-28 w-auto object-contain"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor={`${baseId}-bg-op`}>Opacidade no PDF</Label>
                    <span className="tabular-nums text-muted-foreground">{form.bgOpacityPct}%</span>
                  </div>
                  <input
                    id={`${baseId}-bg-op`}
                    type="range"
                    min={5}
                    max={45}
                    step={1}
                    className="h-2 w-full cursor-pointer accent-primary"
                    value={form.bgOpacityPct}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, bgOpacityPct: Number(e.target.value) || 5 }))
                    }
                  />
                </div>
              </>
            ) : null}
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Topo (cabeçalho)</h3>
            <p className="text-xs text-muted-foreground text-pretty">
              No PDF a faixa do topo usa a <strong className="text-foreground">largura total do A4 (210 mm)</strong>;
              pode ter até <strong className="text-foreground">~{HEADER_MAX_MM_H} mm de altura</strong> para
              preencher melhor o espaço até às cartelas. O selo Nº fica no canto superior direito, por cima da
              imagem.
            </p>
            <ImageSizeHint>
              <p className="m-0">
                <strong className="text-foreground">Dimensões de referência no PDF:</strong> largura{' '}
                <strong className="text-foreground">{HEADER_PDF_WIDTH_MM} mm</strong> (toda a folha) × altura até{' '}
                <strong className="text-foreground">
                  {HEADER_MAX_MM_H} mm (~7 cm)
                </strong>
                . Proporção preservada (<span className="font-mono text-[10px]">contain</span>) — bandas largas e
                baixas enchem a largura; bandas altas limitam-se à altura máxima.
              </p>
              <p className="mt-2 mb-0">
                Em pixels (impressão nítida):{' '}
                <strong className="text-foreground">
                  ≈ {mmToPx(HEADER_PDF_WIDTH_MM, 300)} × {mmToPx(HEADER_MAX_MM_H, 300)} px a 300 ppp
                </strong>
                , ou{' '}
                <strong className="text-foreground">
                  ≈ {mmToPx(HEADER_PDF_WIDTH_MM, 150)} × {mmToPx(HEADER_MAX_MM_H, 150)} px a 150 ppp
                </strong>
                .
              </p>
            </ImageSizeHint>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={headerInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                id={`${baseId}-header`}
                onChange={onPickHeader}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => headerInputRef.current?.click()}>
                Imagem do topo
              </Button>
              {form.headerImageDataUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => {
                    setSlotDirty((d) => ({ ...d, header: true }))
                    setForm((s) => ({ ...s, headerImageDataUrl: null }))
                  }}
                >
                  Remover
                </Button>
              ) : null}
            </div>
            {form.headerImageDataUrl ? (
              <div className="relative overflow-hidden rounded-md border bg-muted/30">
                <img
                  src={form.headerImageDataUrl}
                  alt=""
                  className="mx-auto max-h-24 w-auto object-contain"
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor={`${baseId}-subtitle`}>Texto do cabeçalho (opcional)</Label>
              <Input
                id={`${baseId}-subtitle`}
                value={form.subtitle}
                onChange={(e) => setForm((s) => ({ ...s, subtitle: e.target.value }))}
                placeholder="Ex.: Bingo solidário — entrada gratuita"
                maxLength={200}
              />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Rodapé (parte inferior)</h3>
            <p className="text-xs text-muted-foreground text-pretty">
              Imagem por baixo do QR (opcional); depois a nota de texto, se quiser.
            </p>
            <ImageSizeHint>
              <p className="m-0">
                A imagem usa a{' '}
                <strong className="text-foreground">largura total da área útil</strong> (proporção
                preservada); altura até{' '}
                <strong className="text-foreground">
                  ≈ {FOOTER_MAX_MM_H} mm (~4,8 cm)
                </strong>
                . Área útil típica{' '}
                <strong className="text-foreground">≈ 19,4 cm</strong> de largura ({PDF_MM.w} mm).
                Sugestão para banda larga:{' '}
                <strong className="text-foreground">
                  {PDF_MM.w} × {FOOTER_MAX_MM_H} mm
                </strong>{' '}
                (≈{' '}
                <strong className="text-foreground">
                  {mmToPx(PDF_MM.w, 300)} × {mmToPx(FOOTER_MAX_MM_H, 300)} px a 300 ppp
                </strong>
                ).
              </p>
            </ImageSizeHint>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={footerImgInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                id={`${baseId}-footer-img`}
                onChange={onPickFooterImage}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => footerImgInputRef.current?.click()}
              >
                Imagem de rodapé
              </Button>
              {form.footerImageDataUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => {
                    setSlotDirty((d) => ({ ...d, footer: true }))
                    setForm((s) => ({ ...s, footerImageDataUrl: null }))
                  }}
                >
                  Remover
                </Button>
              ) : null}
            </div>
            {form.footerImageDataUrl ? (
              <div className="relative overflow-hidden rounded-md border bg-muted/30">
                <img
                  src={form.footerImageDataUrl}
                  alt=""
                  className="mx-auto max-h-24 w-auto object-contain"
                />
              </div>
            ) : null}
            <div className="space-y-2">
            <Label htmlFor={`${baseId}-footer`}>Nota no rodapé (opcional)</Label>
            <textarea
              id={`${baseId}-footer`}
              value={form.footerNote}
              onChange={(e) => setForm((s) => ({ ...s, footerNote: e.target.value }))}
              placeholder="Ex.: Obrigado por participar."
              maxLength={400}
              rows={3}
              className={cn(
                'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
              )}
            />
            </div>
          </section>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                A guardar…
              </>
            ) : (
              'Guardar modelo'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
