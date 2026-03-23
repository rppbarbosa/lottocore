import {
  CalendarDays,
  ChevronDown,
  ClipboardList,
  LayoutDashboard,
  Layers,
  ListTree,
  LogOut,
  Menu,
  PanelLeft,
  PlusCircle,
  Settings,
  Shuffle,
  Trophy,
  type LucideIcon,
} from 'lucide-react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast, Toaster } from 'sonner'
import { ThemeCycleButton } from '@/components/app/ThemeCycleButton'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useAuth } from '@/context/AuthContext'
import { useDashboardEvent } from '@/context/DashboardEventContext'
import { useTheme } from '@/context/ThemeContext'
import {
  EVENT_STEP_HEADER,
  EVENT_WORKSPACE_SEGMENTS,
  type EventWorkspaceSeg,
} from '@/lib/event-nav'
import { cn } from '@/lib/utils'

const mainNav = [
  { to: '/app', label: 'Painel', icon: LayoutDashboard, end: true },
  { to: '/app/configuracoes', label: 'Configurações', icon: Settings, end: true },
  /* Documentação: rota comentada em App.tsx
  { to: '/app/ajuda', label: 'Documentação', icon: BookOpen, end: false },
  */
] as const

const SEGMENT_ICONS: Record<EventWorkspaceSeg, LucideIcon> = {
  resumo: LayoutDashboard,
  'gerar-folhas': PlusCircle,
  folhas: Layers,
  'controle-vendas': ClipboardList,
  sorteio: Shuffle,
  vitorias: Trophy,
}

function parseEventRoute(pathname: string): { eventId?: string; step?: string } {
  const parts = pathname.split('/').filter(Boolean)
  if (parts[0] !== 'app' || parts[1] !== 'events' || !parts[2]) return {}
  return { eventId: parts[2], step: parts[3] }
}

function subNavClass(isActive: boolean) {
  return cn(
    'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
    isActive
      ? 'bg-sidebar-accent font-medium text-sidebar-foreground shadow-sm'
      : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
  )
}

function EventosSidebarGroup({
  onNavigate,
  effectiveEventId,
}: {
  onNavigate?: () => void
  effectiveEventId?: string
}) {
  const location = useLocation()
  const underEvents = location.pathname.startsWith('/app/events')
  /** Aberto por defeito para as páginas do evento serem visíveis no painel; o utilizador pode fechar. */
  const [open, setOpen] = useState(true)

  useEffect(() => {
    if (underEvents) setOpen(true)
  }, [underEvents])

  const base = effectiveEventId ? `/app/events/${effectiveEventId}` : ''

  return (
    <div className="rounded-lg px-2">
      <div
        className={cn(
          'flex items-stretch gap-0.5 rounded-lg',
          underEvents && 'bg-sidebar-accent/35',
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex shrink-0 items-center justify-center rounded-l-lg px-2 text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          aria-expanded={open}
          aria-label={open ? 'Fechar submenu Eventos' : 'Abrir submenu Eventos'}
        >
          <ChevronDown
            className={cn('h-4 w-4 transition-transform duration-200', open ? 'rotate-0' : '-rotate-90')}
          />
        </button>
        <NavLink
          to="/app/events"
          end={false}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex min-w-0 flex-1 items-center gap-3 rounded-r-lg py-2 pl-1 pr-3 text-sm font-medium transition-colors',
              isActive || underEvents
                ? 'text-sidebar-foreground'
                : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground',
            )
          }
        >
          <CalendarDays className="h-4 w-4 shrink-0 opacity-90" />
          <span className="truncate">Eventos</span>
        </NavLink>
      </div>
      {open && (
        <div className="mt-1 space-y-0.5 border-l border-sidebar-border/80 py-1 pl-3 ml-4">
          <NavLink
            to="/app/events"
            end
            onClick={onNavigate}
            title="Lista de todos os eventos"
            className={({ isActive }) => subNavClass(isActive)}
          >
            <ListTree className="h-3.5 w-3.5 shrink-0 opacity-80" />
            Lista de eventos
          </NavLink>
          {EVENT_WORKSPACE_SEGMENTS.map(({ seg, label, hint }) => {
            const Icon = SEGMENT_ICONS[seg]
            if (effectiveEventId) {
              return (
                <NavLink
                  key={seg}
                  to={`${base}/${seg}`}
                  end={seg === 'resumo'}
                  onClick={onNavigate}
                  title={hint}
                  className={({ isActive }) => subNavClass(isActive)}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" />
                  <span className="min-w-0 truncate">{label}</span>
                </NavLink>
              )
            }
            return (
              <button
                key={seg}
                type="button"
                title={hint}
                onClick={() => {
                  toast.message('Crie ou abra um evento', {
                    description: 'Use «Lista de eventos» para criar um evento novo ou abrir um existente — depois estes atalhos levam-no às páginas do evento.',
                    duration: 5500,
                  })
                  onNavigate?.()
                }}
                className={cn(
                  subNavClass(false),
                  'w-full cursor-pointer border-0 bg-transparent text-left opacity-[0.72] hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" />
                <span className="min-w-0 truncate">{label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function NavItems({
  onNavigate,
  effectiveEventId,
}: {
  onNavigate?: () => void
  effectiveEventId?: string
}) {
  return (
    <>
      <div className="px-4 pb-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/45">Geral</p>
      </div>
      <nav className="flex flex-col gap-1 px-2">
        {mainNav.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-foreground shadow-sm'
                  : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0 opacity-90" />
            {label}
          </NavLink>
        ))}
        <EventosSidebarGroup onNavigate={onNavigate} effectiveEventId={effectiveEventId} />
      </nav>
    </>
  )
}

export function DashboardLayout() {
  const navigate = useNavigate()
  const { resolved: themeResolved } = useTheme()
  const { logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [headerEventName, setHeaderEventName] = useState('')
  const { focusedEventId, setEventFocus } = useDashboardEvent()

  const handleLogout = useCallback(() => {
    logout()
    navigate('/login', { replace: true })
  }, [logout, navigate])
  const location = useLocation()
  const { eventId: routeEventId, step } = parseEventRoute(location.pathname)

  useEffect(() => {
    if (routeEventId) setEventFocus(routeEventId)
  }, [routeEventId, setEventFocus])

  const effectiveEventId = routeEventId ?? focusedEventId ?? undefined

  useEffect(() => {
    if (!routeEventId) {
      setHeaderEventName('')
      return
    }
    try {
      const lastId = sessionStorage.getItem('lottocore:lastEventId')
      const name = sessionStorage.getItem('lottocore:lastEventName')
      setHeaderEventName(lastId === routeEventId && name ? name : '')
    } catch {
      setHeaderEventName('')
    }
  }, [location.pathname, routeEventId])

  const stepLabel =
    step && step in EVENT_STEP_HEADER ? EVENT_STEP_HEADER[step as EventWorkspaceSeg] : undefined

  const title = useMemo(() => {
    if (routeEventId && headerEventName && stepLabel) return `${headerEventName} · ${stepLabel}`
    if (routeEventId && stepLabel) return stepLabel
    if (location.pathname === '/app/events') return 'Eventos'
    if (location.pathname === '/app/configuracoes') return 'Configurações'
    // if (location.pathname.startsWith('/app/ajuda')) return 'Documentação'
    if (location.pathname === '/app') return 'Painel'
    const hit = mainNav.find((n) =>
      n.end ? location.pathname === n.to : location.pathname.startsWith(n.to),
    )
    return hit?.label ?? 'Painel'
  }, [location.pathname, routeEventId, headerEventName, stepLabel])

  return (
    <div className="flex min-h-svh w-full">
      <Toaster
        theme={themeResolved}
        position="bottom-center"
        closeButton
        offset={72}
        toastOptions={{
          classNames: {
            toast:
              'group border-border/60 bg-background/95 text-foreground shadow-md backdrop-blur-md supports-[backdrop-filter]:bg-background/80',
            title: 'text-sm font-medium',
            description: 'text-xs text-muted-foreground leading-snug',
          },
        }}
      />
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
            LC
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">LottoCore</p>
            <p className="text-xs text-sidebar-foreground/60">Bingo beneficente</p>
          </div>
        </div>
        <ScrollArea className="flex-1 py-4">
          <NavItems effectiveEventId={effectiveEventId} />
        </ScrollArea>
        <div className="border-t border-sidebar-border p-3">
          <Button
            variant="ghost"
            className="w-full justify-start text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Terminar sessão
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:px-6">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
              <SheetHeader className="border-b border-sidebar-border p-4 text-left">
                <SheetTitle className="flex items-center gap-2 text-sidebar-foreground">
                  <PanelLeft className="h-5 w-5" />
                  Menu
                </SheetTitle>
              </SheetHeader>
              <div className="py-4">
                <NavItems
                  effectiveEventId={effectiveEventId}
                  onNavigate={() => setMobileOpen(false)}
                />
              </div>
            </SheetContent>
          </Sheet>
          <h1 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight">{title}</h1>
          <div className="flex shrink-0 items-center gap-0.5">
            <Button variant="ghost" size="icon" className="shrink-0" asChild title="Configurações">
              <NavLink to="/app/configuracoes">
                <Settings className="h-5 w-5" />
                <span className="sr-only">Configurações</span>
              </NavLink>
            </Button>
            <ThemeCycleButton />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={handleLogout}
              title="Terminar sessão"
            >
              <LogOut className="h-5 w-5" />
              <span className="sr-only">Terminar sessão</span>
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
