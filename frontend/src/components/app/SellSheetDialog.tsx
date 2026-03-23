import { useEffect, useState } from 'react'
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
import type { SheetRow } from '@/context/EventWorkspaceContext'
import { ApiError, apiJson } from '@/lib/api'
import { centsToReaisInput, parseReaisToCents } from '@/lib/formatMoney'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

type Props = {
  sheetId: string | null
  sheetNumber?: number
  open: boolean
  onOpenChange: (v: boolean) => void
  onDone: () => void
  /** Folha já vendida: guardar alterações com PATCH */
  editSheet?: SheetRow | null
}

type ViaCepJson = { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string }

async function fetchAddressByCep(raw: string): Promise<string | null> {
  const d = raw.replace(/\D/g, '')
  if (d.length !== 8) return null
  const r = await fetch(`https://viacep.com.br/ws/${d}/json/`)
  if (!r.ok) return null
  const j = (await r.json()) as ViaCepJson
  if (!j || j.erro) return null
  const parts = [j.logradouro, j.bairro].filter(Boolean)
  const city = [j.localidade, j.uf].filter(Boolean).join('/')
  const line = [...parts, city].filter(Boolean).join(' — ')
  return line || null
}

function buildPayload(fields: {
  buyerName: string
  buyerWhatsapp: string
  buyerEmail: string
  buyerCep: string
  buyerAddress: string
  sellerName: string
  priceReais: string
  paidReais: string
}) {
  const priceCents = parseReaisToCents(fields.priceReais)
  const paidCents = parseReaisToCents(fields.paidReais)
  if (fields.priceReais.trim() && priceCents === null) {
    return { error: 'Preço da folha inválido' as const }
  }
  if (fields.paidReais.trim() && paidCents === null) {
    return { error: 'Valor recebido inválido' as const }
  }
  const body: Record<string, string | number | null | undefined> = {
    buyerName: fields.buyerName.trim() || undefined,
    buyerWhatsapp: fields.buyerWhatsapp.trim() || undefined,
    buyerEmail: fields.buyerEmail.trim() || undefined,
    buyerCep: fields.buyerCep.trim() || undefined,
    buyerAddress: fields.buyerAddress.trim() || undefined,
    sellerName: fields.sellerName.trim() || undefined,
    salePriceCents: priceCents,
    amountPaidCents: paidCents ?? 0,
  }
  return { body }
}

export function SellSheetDialog({
  sheetId,
  sheetNumber,
  open,
  onOpenChange,
  onDone,
  editSheet,
}: Props) {
  const mode = editSheet ? 'edit' : 'sell'
  const [buyerName, setBuyerName] = useState('')
  const [buyerWhatsapp, setBuyerWhatsapp] = useState('')
  const [buyerEmail, setBuyerEmail] = useState('')
  const [buyerCep, setBuyerCep] = useState('')
  const [buyerAddress, setBuyerAddress] = useState('')
  const [sellerName, setSellerName] = useState('')
  const [priceReais, setPriceReais] = useState('')
  const [paidReais, setPaidReais] = useState('')
  const [loading, setLoading] = useState(false)
  const [cepLoading, setCepLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (editSheet) {
      setBuyerName(editSheet.buyer_name ?? '')
      setBuyerWhatsapp(editSheet.buyer_whatsapp ?? editSheet.buyer_contact ?? '')
      setBuyerEmail(editSheet.buyer_email ?? '')
      setBuyerCep(editSheet.buyer_cep ?? '')
      setBuyerAddress(editSheet.buyer_address ?? '')
      setSellerName(editSheet.seller_name ?? '')
      setPriceReais(centsToReaisInput(editSheet.sale_price_cents))
      setPaidReais(centsToReaisInput(editSheet.amount_paid_cents ?? 0))
    } else {
      setBuyerName('')
      setBuyerWhatsapp('')
      setBuyerEmail('')
      setBuyerCep('')
      setBuyerAddress('')
      setSellerName('')
      setPriceReais('')
      setPaidReais('')
    }
    setErr(null)
  }, [open, editSheet])

  const fillCep = async () => {
    setErr(null)
    setCepLoading(true)
    try {
      const line = await fetchAddressByCep(buyerCep)
      if (!line) {
        setErr('CEP não encontrado ou inválido.')
        return
      }
      setBuyerAddress((prev) => (prev.trim() ? `${line}\n${prev.trim()}` : line))
    } catch {
      setErr('Não foi possível consultar o CEP. Tente de novo.')
    } finally {
      setCepLoading(false)
    }
  }

  const submit = async () => {
    if (!sheetId) return
    const built = buildPayload({
      buyerName,
      buyerWhatsapp,
      buyerEmail,
      buyerCep,
      buyerAddress,
      sellerName,
      priceReais,
      paidReais,
    })
    if ('error' in built) {
      setErr(built.error ?? 'Dados inválidos')
      return
    }
    setLoading(true)
    setErr(null)
    try {
      if (mode === 'edit') {
        await apiJson(`/api/sheets/${sheetId}`, {
          method: 'PATCH',
          body: JSON.stringify(built.body),
        })
      } else {
        await apiJson(`/api/sheets/${sheetId}/sell`, {
          method: 'POST',
          body: JSON.stringify(built.body),
        })
      }
      onOpenChange(false)
      onDone()
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : mode === 'edit' ? 'Erro ao guardar' : 'Erro ao vender')
    } finally {
      setLoading(false)
    }
  }

  const taClass = cn(
    'flex min-h-[4.5rem] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm',
    'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
    'disabled:cursor-not-allowed disabled:opacity-50',
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? 'Editar venda' : 'Registar venda'}</DialogTitle>
          <DialogDescription className="text-pretty">
            Folha {sheetNumber != null ? `#${sheetNumber}` : ''}. Dados do comprador, vendedor e valores (R$) para
            controlo de caixa.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-2">
            <Label htmlFor="buy-name">Nome</Label>
            <Input id="buy-name" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} autoComplete="name" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="buy-wa">WhatsApp / telefone</Label>
            <Input
              id="buy-wa"
              value={buyerWhatsapp}
              onChange={(e) => setBuyerWhatsapp(e.target.value)}
              inputMode="tel"
              autoComplete="tel"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="buy-email">E-mail</Label>
            <Input
              id="buy-email"
              type="email"
              value={buyerEmail}
              onChange={(e) => setBuyerEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end sm:gap-2">
            <div className="grid gap-2">
              <Label htmlFor="buy-cep">CEP (opcional)</Label>
              <Input
                id="buy-cep"
                value={buyerCep}
                onChange={(e) => setBuyerCep(e.target.value)}
                placeholder="00000-000"
                inputMode="numeric"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
              disabled={cepLoading}
              onClick={() => void fillCep()}
            >
              {cepLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Preencher pelo CEP'}
            </Button>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="buy-address">Endereço completo</Label>
            <textarea
              id="buy-address"
              className={taClass}
              value={buyerAddress}
              onChange={(e) => setBuyerAddress(e.target.value)}
              rows={3}
              autoComplete="street-address"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="seller">Vendedor (identificação)</Label>
            <Input
              id="seller"
              value={sellerName}
              onChange={(e) => setSellerName(e.target.value)}
              placeholder="Nome de quem registou a venda"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="price">Preço da folha (R$)</Label>
              <Input
                id="price"
                value={priceReais}
                onChange={(e) => setPriceReais(e.target.value)}
                placeholder="ex.: 20,00"
                inputMode="decimal"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="paid">Já recebido (R$)</Label>
              <Input
                id="paid"
                value={paidReais}
                onChange={(e) => setPaidReais(e.target.value)}
                placeholder="0,00"
                inputMode="decimal"
              />
            </div>
          </div>
          {err && <p className="text-sm text-destructive">{err}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={submit} disabled={loading || !sheetId}>
            {loading ? 'A guardar…' : mode === 'edit' ? 'Guardar' : 'Marcar como vendida'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
