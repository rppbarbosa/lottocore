import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  apiJson,
  clearStoredAuthToken,
  getStoredAuthToken,
  setStoredAuthToken,
} from '@/lib/api'

export type AuthUser = { id: string; email: string; created_at: string }

type Ctx = {
  user: AuthUser | null
  token: string | null
  ready: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<Ctx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(() => getStoredAuthToken())
  const [ready, setReady] = useState(false)

  const logout = useCallback(() => {
    clearStoredAuthToken()
    setToken(null)
    setUser(null)
  }, [])

  useEffect(() => {
    const onExpired = () => {
      setToken(null)
      setUser(null)
    }
    window.addEventListener('lottocore:auth-expired', onExpired)
    return () => window.removeEventListener('lottocore:auth-expired', onExpired)
  }, [])

  useEffect(() => {
    let cancelled = false
    const t = getStoredAuthToken()
    if (!t) {
      setReady(true)
      return () => {
        cancelled = true
      }
    }
    setToken(t)
    apiJson<{ user: AuthUser }>('/api/auth/me', { authToken: t })
      .then((data) => {
        if (!cancelled) setUser(data.user)
      })
      .catch(() => {
        if (!cancelled) {
          clearStoredAuthToken()
          setToken(null)
          setUser(null)
        }
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiJson<{ token: string; user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      authToken: null,
    })
    setStoredAuthToken(data.token)
    setToken(data.token)
    setUser(data.user)
  }, [])

  const register = useCallback(async (email: string, password: string) => {
    const data = await apiJson<{ token: string; user: AuthUser }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      authToken: null,
    })
    setStoredAuthToken(data.token)
    setToken(data.token)
    setUser(data.user)
  }, [])

  const value = useMemo(
    () => ({ user, token, ready, login, register, logout }),
    [user, token, ready, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}
