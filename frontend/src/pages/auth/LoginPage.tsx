import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ApiOfflineBanner } from '@/components/auth/ApiOfflineBanner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/context/AuthContext'
import { ApiError } from '@/lib/api'

export default function LoginPage() {
  const { token, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/app'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (token) {
    return <Navigate to={from} replace />
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    setLoading(true)
    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Não foi possível iniciar sessão')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md border-border/80 shadow-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">Iniciar sessão</CardTitle>
          <CardDescription className="text-pretty">
            Entre na sua conta LottoCore. Cada utilizador vê apenas os seus eventos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ApiOfflineBanner />
          <form onSubmit={onSubmit} className="space-y-4">
            {err ? (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive text-pretty">
                {err}
              </p>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">Palavra-passe</Label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'A entrar…' : 'Entrar'}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Ainda não tem conta?{' '}
              <Link to="/registo" className="font-medium text-primary underline-offset-4 hover:underline">
                Registar
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
