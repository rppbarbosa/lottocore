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
import {
  centsToCurrencyDigitString,
  digitsOnly,
  formatBRLCentDigitsDisplay,
  formatCepInput,
  formatPhoneBrInput,
  formatUfInput,
  normalizeCurrencyCentDigits,
} from '@/lib/inputMasks'
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

type ViaCepJson = {
  erro?: boolean
  logradouro?: string
  bairro?: string
  localidade?: string
  uf?: string
  complemento?: string
}

async function fetchAddressByCep(raw: string): Promise<{
  street: string
  neighborhood: string
  city: string
  state: string
  complement: string
} | null> {
  const d = raw.replace(/\D/g, '')
  if (d.length !== 8) return null
  const r = await fetch(`https://viacep.com.br/ws/${d}/json/`)
  if (!r.ok) return null
  const j = (await r.json()) as ViaCepJson
  if (!j || j.erro) return null
  return {
    street: (j.logradouro ?? '').trim(),
    neighborhood: (j.bairro ?? '').trim(),
    city: (j.localidade ?? '').trim(),
    state: (j.uf ?? '').toUpperCase().slice(0, 2),
    complement: (j.complemento ?? '').trim(),
  }
}

function buildPayload(fields: {
  buyerName: string
  buyerWhatsapp: string
  buyerEmail: string
  buyerCep: string
  buyerStreet: string
  buyerStreetNumber: string
  buyerComplement: string
  buyerNeighborhood: string
  buyerCity: string
  buyerState: string
  sellerName: string
  priceDigits: string
  paidDigits: string
}) {
  const priceCents =
    fields.priceDigits === '' ? null : parseInt(fields.priceDigits, 10)
  if (fields.priceDigits !== '' && (priceCents === null || !Number.isFinite(priceCents))) {
    return { error: 'Preço da folha inválido' as const }
  }
  const paidStr = fields.paidDigits === '' ? '0' : fields.paidDigits
  const paidCents = parseInt(paidStr, 10)
  if (!Number.isFinite(paidCents) || paidCents < 0) {
    return { error: 'Valor recebido inválido' as const }
  }
  const waDigits = digitsOnly(fields.buyerWhatsapp)
  const cepDigits = digitsOnly(fields.buyerCep)
  const body: Record<string, string | number | null | undefined> = {
    buyerName: fields.buyerName.trim() || undefined,
    buyerWhatsapp: waDigits || undefined,
    buyerEmail: fields.buyerEmail.trim() || undefined,
    buyerCep: cepDigits || undefined,
    buyerStreet: fields.buyerStreet.trim() || undefined,
    buyerStreetNumber: fields.buyerStreetNumber.trim() || undefined,
    buyerAddressComplement: fields.buyerComplement.trim() || undefined,
    buyerNeighborhood: fields.buyerNeighborhood.trim() || undefined,
    buyerCity: fields.buyerCity.trim() || undefined,
    buyerState: fields.buyerState.trim().toUpperCase() || undefined,
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
  const [buyerStreet, setBuyerStreet] = useState('')
  const [buyerStreetNumber, setBuyerStreetNumber] = useState('')
  const [buyerComplement, setBuyerComplement] = useState('')
  const [buyerNeighborhood, setBuyerNeighborhood] = useState('')
  const [buyerCity, setBuyerCity] = useState('')
  const [buyerState, setBuyerState] = useState('')
  const [sellerName, setSellerName] = useState('')
  /** Apenas dígitos = valor em centavos (máscara dinâmica milhares/dezenas). */
  const [priceDigits, setPriceDigits] = useState('')
  const [paidDigits, setPaidDigits] = useState('0')
  const [loading, setLoading] = useState(false)
  const [cepLoading, setCepLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (editSheet) {
      setBuyerName(editSheet.buyer_name ?? '')
      setBuyerWhatsapp(formatPhoneBrInput(editSheet.buyer_whatsapp ?? editSheet.buyer_contact ?? ''))
      setBuyerEmail(editSheet.buyer_email ?? '')
      setBuyerCep(formatCepInput(editSheet.buyer_cep ?? ''))
      const hasParts =
        (editSheet.buyer_street && editSheet.buyer_street.trim()) ||
        (editSheet.buyer_street_number && editSheet.buyer_street_number.trim()) ||
        (editSheet.buyer_address_complement && editSheet.buyer_address_complement.trim()) ||
        (editSheet.buyer_neighborhood && editSheet.buyer_neighborhood.trim()) ||
        (editSheet.buyer_city && editSheet.buyer_city.trim()) ||
        (editSheet.buyer_state && editSheet.buyer_state.trim())
      if (hasParts) {
        setBuyerStreet(editSheet.buyer_street ?? '')
        setBuyerStreetNumber(editSheet.buyer_street_number ?? '')
        setBuyerComplement(editSheet.buyer_address_complement ?? '')
        setBuyerNeighborhood(editSheet.buyer_neighborhood ?? '')
        setBuyerCity(editSheet.buyer_city ?? '')
        setBuyerState(formatUfInput(editSheet.buyer_state ?? ''))
      } else {
        setBuyerStreet(editSheet.buyer_address ?? '')
        setBuyerStreetNumber('')
        setBuyerComplement('')
        setBuyerNeighborhood('')
        setBuyerCity('')
        setBuyerState('')
      }
      setSellerName(editSheet.seller_name ?? '')
      setPriceDigits(centsToCurrencyDigitString(editSheet.sale_price_cents))
      setPaidDigits(centsToCurrencyDigitString(editSheet.amount_paid_cents ?? 0) || '0')
    } else {
      setBuyerName('')
      setBuyerWhatsapp('')
      setBuyerEmail('')
      setBuyerCep('')
      setBuyerStreet('')
      setBuyerStreetNumber('')
      setBuyerComplement('')
      setBuyerNeighborhood('')
      setBuyerCity('')
      setBuyerState('')
      setSellerName('')
      setPriceDigits('')
      setPaidDigits('0')
    }
    setErr(null)
  }, [open, editSheet])

  const fillCep = async () => {
    setErr(null)
    setCepLoading(true)
    try {
      const data = await fetchAddressByCep(buyerCep)
      if (!data) {
        setErr('CEP não encontrado ou inválido.')
        return
      }
      if (data.street) setBuyerStreet(data.street)
      if (data.neighborhood) setBuyerNeighborhood(data.neighborhood)
      if (data.city) setBuyerCity(data.city)
      if (data.state) setBuyerState(data.state)
      setBuyerComplement((prev) => (prev.trim() ? prev : data.complement))
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
      buyerStreet,
      buyerStreetNumber,
      buyerComplement,
      buyerNeighborhood,
      buyerCity,
      buyerState,
      sellerName,
      priceDigits,
      paidDigits,
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

  const inClass = 'w-full'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,760px)] overflow-y-auto sm:max-w-lg">
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
            <Input
              id="buy-name"
              className={inClass}
              value={buyerName}
              maxLength={200}
              onChange={(e) => setBuyerName(e.target.value)}
              autoComplete="name"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="buy-wa">WhatsApp / telefone</Label>
            <Input
              id="buy-wa"
              className={inClass}
              value={buyerWhatsapp}
              onChange={(e) => setBuyerWhatsapp(formatPhoneBrInput(e.target.value))}
              placeholder="(00) 00000-0000"
              inputMode="numeric"
              autoComplete="tel"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="buy-email">E-mail</Label>
            <Input
              id="buy-email"
              type="email"
              className={inClass}
              value={buyerEmail}
              maxLength={254}
              onChange={(e) => setBuyerEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end sm:gap-2">
            <div className="grid gap-2">
              <Label htmlFor="buy-cep">CEP (opcional)</Label>
              <Input
                id="buy-cep"
                className={inClass}
                value={buyerCep}
                onChange={(e) => setBuyerCep(formatCepInput(e.target.value))}
                placeholder="00000-000"
                inputMode="numeric"
                autoComplete="postal-code"
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

          <div className="space-y-2 rounded-md border border-border/80 bg-muted/30 p-3">
            <p className="text-sm font-medium text-foreground">Endereço</p>
            <div className="grid gap-2">
              <Label htmlFor="buy-street">Logradouro</Label>
              <Input
                id="buy-street"
                className={inClass}
                value={buyerStreet}
                maxLength={200}
                onChange={(e) => setBuyerStreet(e.target.value)}
                autoComplete="address-line1"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="buy-num">Número</Label>
                <Input
                  id="buy-num"
                  className={inClass}
                  value={buyerStreetNumber}
                  maxLength={30}
                  onChange={(e) => setBuyerStreetNumber(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="buy-compl">Complemento</Label>
                <Input
                  id="buy-compl"
                  className={inClass}
                  value={buyerComplement}
                  maxLength={120}
                  onChange={(e) => setBuyerComplement(e.target.value)}
                  autoComplete="address-line2"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="buy-neigh">Bairro</Label>
              <Input
                id="buy-neigh"
                className={inClass}
                value={buyerNeighborhood}
                maxLength={120}
                onChange={(e) => setBuyerNeighborhood(e.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_4rem]">
              <div className="grid gap-2">
                <Label htmlFor="buy-city">Cidade</Label>
                <Input
                  id="buy-city"
                  className={inClass}
                  value={buyerCity}
                  maxLength={100}
                  onChange={(e) => setBuyerCity(e.target.value)}
                  autoComplete="address-level2"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="buy-uf">UF</Label>
                <Input
                  id="buy-uf"
                  className={cn(inClass, 'uppercase')}
                  value={buyerState}
                  maxLength={2}
                  onChange={(e) => setBuyerState(formatUfInput(e.target.value))}
                  autoComplete="address-level1"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="seller">Vendedor (identificação)</Label>
            <Input
              id="seller"
              className={inClass}
              value={sellerName}
              maxLength={200}
              onChange={(e) => setSellerName(e.target.value)}
              placeholder="Nome de quem registou a venda"
            />
          </div>
          <div className="grid gap-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="price">Preço da folha (R$)</Label>
                <Input
                  id="price"
                  className={cn(inClass, 'tabular-nums')}
                  value={formatBRLCentDigitsDisplay(priceDigits)}
                  onChange={(e) => setPriceDigits(normalizeCurrencyCentDigits(e.target.value))}
                  placeholder="0,00"
                  inputMode="numeric"
                  autoComplete="transaction-amount"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="paid">Já recebido (R$)</Label>
                <Input
                  id="paid"
                  className={cn(inClass, 'tabular-nums')}
                  value={formatBRLCentDigitsDisplay(paidDigits)}
                  onChange={(e) => {
                    const n = normalizeCurrencyCentDigits(e.target.value)
                    setPaidDigits(n === '' ? '0' : n)
                  }}
                  placeholder="0,00"
                  inputMode="numeric"
                  autoComplete="transaction-amount"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-pretty">
              Nos campos em R$, use só algarismos: cada dígito entra à direita (como em maquininha). Ex.: 1000000 →
              10.000,00.
            </p>
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
