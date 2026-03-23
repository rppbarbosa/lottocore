import { Check, LogOut } from 'lucide-react'
import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/context/AuthContext'
import { useTheme, type ThemePreference } from '@/context/ThemeContext'
import { cn } from '@/lib/utils'

const THEME_OPTS: { value: ThemePreference; label: string; hint: string }[] = [
  { value: 'light', label: 'Claro', hint: 'Tema claro fixo' },
  { value: 'dark', label: 'Escuro', hint: 'Tema escuro fixo' },
  { value: 'system', label: 'Sistema', hint: 'Segue o dispositivo' },
]

export default function SettingsPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { preference, setPreference } = useTheme()

  const handleLogout = useCallback(() => {
    logout()
    navigate('/login', { replace: true })
  }, [logout, navigate])

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Configurações</h2>
        <p className="mt-1 text-sm text-muted-foreground text-pretty">
          Conta e aparência da aplicação. O botão de tema no topo continua a alternar rapidamente entre modos.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Conta</CardTitle>
          <CardDescription>Sessão atual</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">
            <span className="text-muted-foreground">Email</span>
            <br />
            <span className="font-medium text-foreground">{user?.email ?? '—'}</span>
          </p>
          <Button type="button" variant="outline" className="gap-2" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Terminar sessão
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Aparência</CardTitle>
          <CardDescription>Cor de fundo e contraste em todo o painel</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {THEME_OPTS.map(({ value, label, hint }) => (
            <button
              key={value}
              type="button"
              onClick={() => setPreference(value)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left text-sm transition-colors',
                preference === value
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-muted/60',
              )}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center text-primary">
                {preference === value ? <Check className="h-4 w-4" /> : null}
              </span>
              <span>
                <span className="font-medium text-foreground">{label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>
              </span>
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
