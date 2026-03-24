import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from '@/context/AuthContext'
import { ApiError, apiFetchPdf, apiFetchRaster, apiFetchZip, apiJson } from '@/lib/api'

export type RoundDto = { id: string; round_number: number; status: string }

/** Modelo de impressão PDF (event.print_settings) — imagens em disco; metadados + flags. */
export type EventPrintSettings = {
  hasBackgroundImage?: boolean
  hasHeaderImage?: boolean
  hasFooterImage?: boolean
  backgroundOpacity?: number | null
  subtitle?: string | null
  footerNote?: string | null
  /** Legado: resposta antiga com data URL embutida */
  backgroundImageDataUrl?: string | null
  headerImageDataUrl?: string | null
  footerImageDataUrl?: string | null
}

/** PATCH /print-settings: use keep* quando a imagem não mudou; data URL só para ficheiro novo. */
export type PrintSettingsSavePayload = {
  keepBackgroundImage?: boolean
  keepHeaderImage?: boolean
  keepFooterImage?: boolean
  backgroundImageDataUrl?: string | null
  headerImageDataUrl?: string | null
  footerImageDataUrl?: string | null
  subtitle?: string | null
  footerNote?: string | null
  backgroundOpacity?: number | null
}
export type SheetRow = {
  id: string
  sheet_number: number
  sale_status: string
  buyer_name: string | null
  buyer_contact?: string | null
  buyer_whatsapp?: string | null
  buyer_email?: string | null
  buyer_address?: string | null
  buyer_cep?: string | null
  buyer_street?: string | null
  buyer_street_number?: string | null
  buyer_address_complement?: string | null
  buyer_neighborhood?: string | null
  buyer_city?: string | null
  buyer_state?: string | null
  seller_name?: string | null
  sale_price_cents?: number | null
  amount_paid_cents?: number | null
  card_count: number
  public_token: string
}
export type DrawnRow = { number: number; draw_order: number }
export type WinnerRow = {
  card_id: string
  public_token: string
  win_status: string
  sheet_number: number
  sale_status: string
}

/** Formato de cada ficheiro dentro do ZIP de exportação em lote (GET …/export-pdfs?format=). */
export type BulkSheetExportFormat = 'pdf' | 'jpeg' | 'png'

export type DownloadBulkSheetsZipOpts =
  | ({ all: true } & { format: BulkSheetExportFormat })
  | ({ from: number; to: number } & { format: BulkSheetExportFormat })

type Ctx = {
  eventId: string
  eventName: string
  eventStatus: string
  printSettings: EventPrintSettings
  rounds: RoundDto[]
  selectedRoundId: string
  setSelectedRoundId: (id: string) => void
  sheets: SheetRow[]
  loadingEvent: boolean
  loadingSheets: boolean
  loadingRound: boolean
  drawn: DrawnRow[]
  winners: WinnerRow[]
  actionErr: string | null
  setActionErr: (v: string | null) => void
  pdfLoading: string | null
  loadEvent: () => Promise<void>
  savePrintSettings: (settings: PrintSettingsSavePayload) => Promise<void>
  loadSheets: () => Promise<void>
  downloadPdf: (sheetId: string) => Promise<void>
  previewPdf: (sheetId: string) => Promise<void>
  downloadRaster: (sheetId: string, format: 'png' | 'jpeg') => Promise<void>
  downloadBulkPdfsZip: (opts: DownloadBulkSheetsZipOpts) => Promise<void>
  doDraw: (n: number) => Promise<boolean>
  doUndo: () => Promise<void>
  setRoundStatus: (roundId: string, status: string) => Promise<void>
  confirmWin: (cardId: string) => Promise<void>
  dismissWin: (cardId: string) => Promise<void>
}

const EventWorkspaceContext = createContext<Ctx | null>(null)

/** Token de `pdfLoading` para exportação ZIP em lote (várias folhas). */
export const BULK_PDF_ZIP_LOADING = 'bulk-pdf-zip'

const LAST_EVENT_ID = 'lottocore:lastEventId'
const LAST_EVENT_NAME = 'lottocore:lastEventName'

export function EventWorkspaceProvider({
  eventId,
  children,
}: {
  eventId: string
  children: ReactNode
}) {
  const { token } = useAuth()

  const [eventName, setEventName] = useState('')
  const [eventStatus, setEventStatus] = useState('')
  const [printSettings, setPrintSettings] = useState<EventPrintSettings>({})
  const [rounds, setRounds] = useState<RoundDto[]>([])
  const [selectedRoundId, setSelectedRoundId] = useState('')
  const [sheets, setSheets] = useState<SheetRow[]>([])
  const [drawn, setDrawn] = useState<DrawnRow[]>([])
  const [winners, setWinners] = useState<WinnerRow[]>([])
  const [loadingEvent, setLoadingEvent] = useState(true)
  const [loadingSheets, setLoadingSheets] = useState(false)
  const [loadingRound, setLoadingRound] = useState(false)
  const [actionErr, setActionErr] = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState<string | null>(null)

  const loadEvent = useCallback(async () => {
    if (!eventId || !token) return
    setLoadingEvent(true)
    setActionErr(null)
    try {
      const data = await apiJson<{
        event: { name: string; status: string; print_settings?: unknown }
        rounds: RoundDto[]
      }>(`/api/events/${eventId}`)
      setEventName(data.event.name)
      setEventStatus(data.event.status)
      const ps = data.event.print_settings
      setPrintSettings(ps && typeof ps === 'object' ? (ps as EventPrintSettings) : {})
      setRounds(data.rounds)
      try {
        sessionStorage.setItem(LAST_EVENT_ID, eventId)
        sessionStorage.setItem(LAST_EVENT_NAME, data.event.name)
      } catch {
        /* ignore */
      }
      setSelectedRoundId((prev) => {
        if (prev && data.rounds.some((r) => r.id === prev)) return prev
        return data.rounds[0]?.id ?? ''
      })
    } catch (e) {
      setActionErr(e instanceof ApiError ? e.message : 'Erro ao carregar evento')
    } finally {
      setLoadingEvent(false)
    }
  }, [eventId, token])

  const savePrintSettings = useCallback(
    async (settings: PrintSettingsSavePayload) => {
      if (!eventId || !token) return
      setActionErr(null)
      try {
        const res = await apiJson<{ print_settings: EventPrintSettings }>(
          `/api/events/${eventId}/print-settings`,
          { method: 'PATCH', body: JSON.stringify(settings) },
        )
        setPrintSettings(res.print_settings && typeof res.print_settings === 'object' ? res.print_settings : {})
      } catch (e) {
        setActionErr(e instanceof ApiError ? e.message : 'Erro ao guardar modelo de impressão')
        throw e
      }
    },
    [eventId, token],
  )

  const loadSheets = useCallback(async () => {
    if (!eventId || !token) return
    setLoadingSheets(true)
    try {
      const data = await apiJson<{ sheets: SheetRow[] }>(`/api/events/${eventId}/sheets`)
      setSheets(data.sheets)
    } catch {
      setSheets([])
    } finally {
      setLoadingSheets(false)
    }
  }, [eventId, token])

  const loadRound = useCallback(async () => {
    if (!selectedRoundId || !token) {
      setDrawn([])
      return
    }
    setLoadingRound(true)
    try {
      const data = await apiJson<{ drawn: DrawnRow[] }>(`/api/rounds/${selectedRoundId}`)
      setDrawn(data.drawn)
    } catch {
      setDrawn([])
    } finally {
      setLoadingRound(false)
    }
  }, [selectedRoundId, token])

  const loadWinners = useCallback(async () => {
    if (!selectedRoundId || !token) {
      setWinners([])
      return
    }
    try {
      const data = await apiJson<{ winners: WinnerRow[] }>(
        `/api/rounds/${selectedRoundId}/winners`,
      )
      setWinners(data.winners)
    } catch {
      setWinners([])
    }
  }, [selectedRoundId, token])

  /** Refs para o handler WS não depender de load* — senão cada mudança de rodada recria o efeito e fecha o socket em CONNECTING. */
  const loadEventRef = useRef(loadEvent)
  const loadSheetsRef = useRef(loadSheets)
  const loadRoundRef = useRef(loadRound)
  const loadWinnersRef = useRef(loadWinners)
  useEffect(() => {
    loadEventRef.current = loadEvent
    loadSheetsRef.current = loadSheets
    loadRoundRef.current = loadRound
    loadWinnersRef.current = loadWinners
  })

  useEffect(() => {
    void loadEvent()
  }, [loadEvent])

  useEffect(() => {
    void loadSheets()
  }, [loadSheets])

  useEffect(() => {
    void loadRound()
  }, [loadRound])

  useEffect(() => {
    void loadWinners()
  }, [loadWinners])

  useEffect(() => {
    if (!token || !eventId) return
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${proto}//${window.location.host}/ws?eventId=${encodeURIComponent(eventId)}`
    let ws: WebSocket
    try {
      ws = new WebSocket(url)
    } catch {
      return
    }
    let active = true
    ws.onmessage = () => {
      if (!active) return
      void loadRoundRef.current()
      void loadWinnersRef.current()
      void loadSheetsRef.current()
      void loadEventRef.current()
    }
    ws.onerror = () => {
      /* Backend offline ou proxy sem WS — evita ruído; o painel continua por HTTP */
    }
    const safeClose = () => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.close(1000, 'cleanup')
        } catch {
          /* noop */
        }
        return
      }
      if (ws.readyState === WebSocket.CONNECTING) {
        ws.addEventListener(
          'open',
          () => {
            try {
              ws.close(1000, 'cleanup')
            } catch {
              /* noop */
            }
          },
          { once: true },
        )
      }
    }
    return () => {
      active = false
      ws.onmessage = null
      ws.onerror = null
      safeClose()
    }
  }, [eventId, token])

  const downloadPdf = useCallback(async (sheetId: string) => {
    setPdfLoading(sheetId)
    setActionErr(null)
    try {
      const { blob, filename } = await apiFetchPdf(`/api/sheets/${sheetId}/pdf`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setActionErr(e instanceof ApiError ? e.message : 'Não foi possível gerar o PDF.')
    } finally {
      setPdfLoading(null)
    }
  }, [])

  const previewPdf = useCallback(async (sheetId: string) => {
    setPdfLoading(sheetId)
    setActionErr(null)
    try {
      const { blob } = await apiFetchPdf(`/api/sheets/${sheetId}/pdf`)
      const url = URL.createObjectURL(blob)
      const w = window.open(url, '_blank', 'noopener,noreferrer')
      if (!w) {
        URL.revokeObjectURL(url)
        setActionErr('O navegador bloqueou a nova janela. Permita pop-ups para visualizar o PDF.')
        return
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 120_000)
    } catch (e) {
      setActionErr(e instanceof ApiError ? e.message : 'Não foi possível visualizar o PDF.')
    } finally {
      setPdfLoading(null)
    }
  }, [])

  const downloadRaster = useCallback(async (sheetId: string, format: 'png' | 'jpeg') => {
    setPdfLoading(sheetId)
    setActionErr(null)
    try {
      const q = format === 'png' ? 'format=png' : 'format=jpeg'
      const { blob, filename } = await apiFetchRaster(
        `/api/sheets/${sheetId}/export?${q}`,
        format,
      )
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setActionErr(e instanceof ApiError ? e.message : 'Não foi possível descarregar a imagem.')
    } finally {
      setPdfLoading(null)
    }
  }, [])

  const downloadBulkPdfsZip = useCallback(
    async (opts: DownloadBulkSheetsZipOpts) => {
      setPdfLoading(BULK_PDF_ZIP_LOADING)
      setActionErr(null)
      try {
        const base =
          'all' in opts
            ? 'all=1'
            : `from=${encodeURIComponent(String(opts.from))}&to=${encodeURIComponent(String(opts.to))}`
        const q = `${base}&format=${encodeURIComponent(opts.format)}`
        const { blob, filename } = await apiFetchZip(`/api/events/${eventId}/sheets/export-pdfs?${q}`)
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
      } catch (e) {
        setActionErr(e instanceof ApiError ? e.message : 'Não foi possível gerar o arquivo ZIP.')
      } finally {
        setPdfLoading(null)
      }
    },
    [eventId],
  )

  const doDraw = useCallback(
    async (n: number) => {
      if (!selectedRoundId) return false
      setActionErr(null)
      try {
        await apiJson(`/api/rounds/${selectedRoundId}/draw`, {
          method: 'POST',
          body: JSON.stringify({ number: n }),
        })
        void loadRound()
        void loadWinners()
        return true
      } catch (e) {
        setActionErr(e instanceof ApiError ? e.message : 'Sorteio falhou')
        return false
      }
    },
    [selectedRoundId, loadRound, loadWinners],
  )

  const doUndo = useCallback(async () => {
    if (!selectedRoundId) return
    setActionErr(null)
    try {
      await apiJson(`/api/rounds/${selectedRoundId}/draw/undo`, { method: 'POST' })
      void loadRound()
      void loadWinners()
    } catch (e) {
      setActionErr(e instanceof ApiError ? e.message : 'Undo falhou')
    }
  }, [selectedRoundId, loadRound, loadWinners])

  const setRoundStatus = useCallback(
    async (roundId: string, status: string) => {
      setActionErr(null)
      try {
        await apiJson(`/api/rounds/${roundId}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        })
        void loadEvent()
      } catch (e) {
        setActionErr(e instanceof ApiError ? e.message : 'Não foi possível atualizar a rodada')
      }
    },
    [loadEvent],
  )

  const confirmWin = useCallback(
    async (cardId: string) => {
      try {
        await apiJson(`/api/cards/${cardId}/win/confirm`, { method: 'POST' })
        void loadWinners()
      } catch (e) {
        setActionErr(e instanceof ApiError ? e.message : 'Confirmação falhou')
      }
    },
    [loadWinners],
  )

  const dismissWin = useCallback(
    async (cardId: string) => {
      try {
        await apiJson(`/api/cards/${cardId}/win/dismiss`, { method: 'POST' })
        void loadWinners()
      } catch (e) {
        setActionErr(e instanceof ApiError ? e.message : 'Operação falhou')
      }
    },
    [loadWinners],
  )

  const value = useMemo<Ctx>(
    () => ({
      eventId,
      eventName,
      eventStatus,
      printSettings,
      rounds,
      selectedRoundId,
      setSelectedRoundId,
      sheets,
      loadingEvent,
      loadingSheets,
      loadingRound,
      drawn,
      winners,
      actionErr,
      setActionErr,
      pdfLoading,
      loadEvent,
      savePrintSettings,
      loadSheets,
      downloadPdf,
      previewPdf,
      downloadRaster,
      downloadBulkPdfsZip,
      doDraw,
      doUndo,
      setRoundStatus,
      confirmWin,
      dismissWin,
    }),
    [
      eventId,
      eventName,
      eventStatus,
      printSettings,
      rounds,
      selectedRoundId,
      sheets,
      loadingEvent,
      loadingSheets,
      loadingRound,
      drawn,
      winners,
      actionErr,
      pdfLoading,
      loadEvent,
      savePrintSettings,
      loadSheets,
      downloadPdf,
      previewPdf,
      downloadRaster,
      downloadBulkPdfsZip,
      doDraw,
      doUndo,
      setRoundStatus,
      confirmWin,
      dismissWin,
    ],
  )

  return <EventWorkspaceContext.Provider value={value}>{children}</EventWorkspaceContext.Provider>
}

export function useEventWorkspace() {
  const ctx = useContext(EventWorkspaceContext)
  if (!ctx) throw new Error('useEventWorkspace outside provider')
  return ctx
}

export function getLastEventId(): string | null {
  try {
    return sessionStorage.getItem(LAST_EVENT_ID)
  } catch {
    return null
  }
}
