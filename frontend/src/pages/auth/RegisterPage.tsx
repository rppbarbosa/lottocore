import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ApiOfflineBanner } from '@/components/auth/ApiOfflineBanner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/context/AuthContext'
import { ApiError } from '@/lib/api'

export default function RegisterPage() {
  const { token, register } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (token) {
    return <Navigate to="/app" replace />
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    setLoading(true)
    try {
      await register(email, password)
      navigate('/app', { replace: true })
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Não foi possível criar a conta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md border-border/80 shadow-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">Criar conta</CardTitle>
          <CardDescription className="text-pretty">
            Registe-se para criar e gerir os seus eventos de bingo. A palavra-passe deve ter pelo menos 8 caracteres.
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
              <Label htmlFor="reg-email">Email</Label>
              <Input
                id="reg-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-password">Palavra-passe</Label>
              <Input
                id="reg-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'A criar conta…' : 'Registar'}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Já tem conta?{' '}
              <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
                Iniciar sessão
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
