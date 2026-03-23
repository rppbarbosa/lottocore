import { sheetLayoutDescription } from '@/lib/sheetLayouts'
import { cn } from '@/lib/utils'

type Props = {
  cardsPerSheet: number
  className?: string
}

/** Pré-visualização esquemática da folha A4 (só disposição; números vêm na geração). */
export function SheetLayoutPreview({ cardsPerSheet, className }: Props) {
  const n = Math.min(5, Math.max(1, Math.floor(cardsPerSheet)))

  return (
    <div className={cn('space-y-3', className)}>
      <p className="text-sm text-muted-foreground text-pretty">{sheetLayoutDescription(n)}</p>
      <div
        className="mx-auto w-full max-w-[220px] rounded-md border-2 border-dashed border-muted-foreground/40 bg-muted/20 p-2 shadow-sm sm:max-w-[260px]"
        style={{ aspectRatio: '210 / 297' }}
      >
        <div className="flex h-full w-full flex-col gap-1">
          <div className="shrink-0 rounded bg-background/80 px-1 py-0.5 text-center text-[9px] font-medium text-muted-foreground">
            Folha A4 · {n} cartela{n > 1 ? 's' : ''}
          </div>
          <div className="min-h-0 flex-1">{renderMiniLayout(n)}</div>
        </div>
      </div>
    </div>
  )
}

function MiniCell({
  kind,
  label,
}: {
  kind: 'card' | 'gap'
  label?: string
}) {
  if (kind === 'gap') {
    return (
      <div
        className="flex min-h-[18px] items-center justify-center rounded border border-dashed border-muted-foreground/25 bg-muted/30 text-[7px] text-muted-foreground/70"
        title="Espaço livre (imagens ou texto no futuro)"
      >
        ···
      </div>
    )
  }
  return (
    <div className="flex min-h-[28px] flex-col items-center justify-center rounded border border-primary/40 bg-primary/5 px-0.5 py-1">
      <span className="text-[8px] font-semibold text-primary">{label}</span>
      <div className="mt-0.5 grid w-full max-w-[48px] grid-cols-5 gap-px">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-[1px] bg-muted-foreground/15" />
        ))}
      </div>
    </div>
  )
}

function renderMiniLayout(n: number) {
  if (n === 1) {
    return (
      <div className="flex h-full items-center justify-center p-1">
        <div className="w-[70%]">
          <MiniCell kind="card" label="1" />
        </div>
      </div>
    )
  }
  if (n === 2) {
    return (
      <div className="grid h-full grid-cols-2 gap-1 p-1">
        <MiniCell kind="card" label="1" />
        <MiniCell kind="card" label="2" />
      </div>
    )
  }
  if (n === 3) {
    return (
      <div className="grid h-full grid-cols-2 grid-rows-[1fr_auto] gap-1 p-1">
        <MiniCell kind="card" label="1" />
        <MiniCell kind="card" label="2" />
        <div className="col-span-2 flex justify-center">
          <div className="w-[55%]">
            <MiniCell kind="card" label="3" />
          </div>
        </div>
      </div>
    )
  }
  if (n === 4) {
    return (
      <div className="grid h-full grid-cols-2 grid-rows-2 gap-1 p-1">
        <MiniCell kind="card" label="1" />
        <MiniCell kind="card" label="2" />
        <MiniCell kind="card" label="3" />
        <MiniCell kind="card" label="4" />
      </div>
    )
  }
  // 5 — mesma lógica que o PDF: cantos + centro
  return (
    <div className="grid h-full grid-cols-3 grid-rows-3 gap-1 p-0.5">
      <MiniCell kind="card" label="1" />
      <MiniCell kind="gap" />
      <MiniCell kind="card" label="2" />
      <MiniCell kind="gap" />
      <MiniCell kind="card" label="3" />
      <MiniCell kind="gap" />
      <MiniCell kind="card" label="4" />
      <MiniCell kind="gap" />
      <MiniCell kind="card" label="5" />
    </div>
  )
}
