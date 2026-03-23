import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

const STORAGE_ID = 'lottocore:lastEventId'
const STORAGE_NAME = 'lottocore:lastEventName'

type Ctx = {
  /** Evento em foco no painel (selector em /app); persiste em sessionStorage. */
  focusedEventId: string | null
  setEventFocus: (id: string | null, name?: string | null) => void
}

const DashboardEventContext = createContext<Ctx | null>(null)

function readStoredId(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_ID)
  } catch {
    return null
  }
}

export function DashboardEventProvider({ children }: { children: ReactNode }) {
  const [focusedEventId, setFocusedEventId] = useState<string | null>(() => readStoredId())

  const setEventFocus = useCallback((id: string | null, name?: string | null) => {
    setFocusedEventId(id)
    try {
      if (id) {
        sessionStorage.setItem(STORAGE_ID, id)
        if (name != null && name !== '') sessionStorage.setItem(STORAGE_NAME, name)
      } else {
        sessionStorage.removeItem(STORAGE_ID)
        sessionStorage.removeItem(STORAGE_NAME)
      }
    } catch {
      /* ignore */
    }
  }, [])

  const value = useMemo(() => ({ focusedEventId, setEventFocus }), [focusedEventId, setEventFocus])

  return <DashboardEventContext.Provider value={value}>{children}</DashboardEventContext.Provider>
}

export function useDashboardEvent() {
  const ctx = useContext(DashboardEventContext)
  if (!ctx) throw new Error('useDashboardEvent outside DashboardEventProvider')
  return ctx
}
