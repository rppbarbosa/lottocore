import { cn } from '@/lib/utils'

export type PrintTemplatePreviewFields = {
  backgroundImageDataUrl: string | null
  bgOpacityPct: number
  headerImageDataUrl: string | null
  footerImageDataUrl: string | null
  subtitle: string
  footerNote: string
}

type Props = {
  form: PrintTemplatePreviewFields
  className?: string
}

/**
 * Miniatura A4 (~proporção PDF) com marca d'água, cabeçalho, selo Nº, blocos fictícios de cartelas e rodapé.
 * Reflete apenas o estado local do formulário (antes de guardar).
 */
export function PrintTemplateSheetPreview({ form, className }: Props) {
  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-center text-xs font-medium text-foreground">Pré-visualização do PDF</p>
      <p className="text-center text-[11px] text-muted-foreground text-pretty">
        Atualiza ao escolher imagens, texto ou opacidade — ainda não está guardado no evento.
      </p>
      <div
        className="relative mx-auto w-full max-w-[220px] overflow-hidden rounded-md border border-neutral-800/25 bg-white shadow-md"
        style={{ aspectRatio: '210 / 297' }}
      >
        {form.backgroundImageDataUrl ? (
          <div
            className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: `url(${form.backgroundImageDataUrl})`,
              opacity: form.bgOpacityPct / 100,
            }}
            aria-hidden
          />
        ) : null}
        <div className="relative z-10 flex h-full min-h-0 flex-col px-[5%] pb-[4%] pt-[4%]">
          <div className="mb-[3%] flex items-start justify-between gap-1">
            <div className="min-w-0 flex-1">
              {form.headerImageDataUrl ? (
                <img
                  src={form.headerImageDataUrl}
                  alt=""
                  className="mb-0.5 max-h-[min(28px,7vw)] w-auto max-w-full object-contain object-left"
                />
              ) : null}
              {form.subtitle.trim() ? (
                <p className="line-clamp-2 text-[0.5rem] font-medium leading-snug text-neutral-700">
                  {form.subtitle}
                </p>
              ) : null}
              {!form.headerImageDataUrl && !form.subtitle.trim() ? (
                <span className="text-[0.45rem] text-neutral-400">Sem cabeçalho</span>
              ) : null}
            </div>
            <div
              className="shrink-0 rounded-full border border-neutral-900 bg-neutral-100 px-1 py-0.5 text-[0.45rem] font-extrabold tracking-wide text-neutral-900"
              title="Exemplo"
            >
              Nº <span className="text-red-600">0001</span>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col justify-center gap-[2%] py-[2%]">
            <div className="flex justify-center gap-[2%]">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="aspect-square w-[26%] max-w-[52px] rounded-sm border border-dashed border-neutral-400/90 bg-neutral-50/90"
                  aria-hidden
                />
              ))}
            </div>
            <div className="flex justify-center gap-[2%]">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="aspect-square w-[26%] max-w-[52px] rounded-sm border border-dashed border-neutral-400/90 bg-neutral-50/90"
                  aria-hidden
                />
              ))}
            </div>
          </div>

          <div className="mt-auto border-t border-neutral-300/90 pt-[2%] text-center">
            <div
              className="mx-auto inline-block rounded border border-neutral-300 bg-white px-0.5 pb-0.5 pt-0.5 shadow-sm"
              aria-hidden
            >
              <div className="mx-auto size-5 rounded-sm border border-dashed border-neutral-400 bg-neutral-50" />
              <p className="text-[0.38rem] text-neutral-500">QR</p>
            </div>
            <p className="mt-0.5 text-[0.45rem] text-neutral-500">Conferir folha</p>
            {form.footerImageDataUrl ? (
              <img
                src={form.footerImageDataUrl}
                alt=""
                className="mx-auto mt-1 max-h-[min(20px,6vw)] w-auto max-w-[90%] object-contain"
              />
            ) : null}
            {form.footerNote.trim() ? (
              <p className="mt-0.5 line-clamp-3 text-[0.48rem] leading-snug text-neutral-600">
                {form.footerNote}
              </p>
            ) : (
              <p className="mt-0.5 text-[0.42rem] text-neutral-400">Sem nota de rodapé</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
