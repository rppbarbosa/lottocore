import { Navigate, Route, Routes } from 'react-router-dom'
import { LegacySegRedirect } from '@/components/app/LegacySegRedirect'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { AuthProvider } from '@/context/AuthContext'
import { DashboardEventProvider } from '@/context/DashboardEventContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { EventLayout } from '@/layouts/EventLayout'
import DashboardPage from '@/pages/app/DashboardPage'
import EventDrawPage from '@/pages/app/event/EventDrawPage'
import EventGenerateSheetsPage from '@/pages/app/event/EventGenerateSheetsPage'
import EventSalesControlPage from '@/pages/app/event/EventSalesControlPage'
import EventSheetsManagePage from '@/pages/app/event/EventSheetsManagePage'
import EventSummaryPage from '@/pages/app/event/EventSummaryPage'
import EventValidationPage from '@/pages/app/event/EventValidationPage'
import EventsPage from '@/pages/app/EventsPage'
import SettingsPage from '@/pages/app/SettingsPage'
// import HelpPage from '@/pages/app/HelpPage'
import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import PublicSheetPage from '@/pages/PublicSheetPage'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <DashboardEventProvider>
          <Routes>
            <Route path="/f/:token" element={<PublicSheetPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/registo" element={<RegisterPage />} />
            <Route element={<RequireAuth />}>
              <Route element={<DashboardLayout />}>
                <Route path="/app" element={<DashboardPage />} />
                <Route path="/app/configuracoes" element={<SettingsPage />} />
                <Route path="/app/events" element={<EventsPage />} />
                <Route path="/app/events/:eventId" element={<EventLayout />}>
                  <Route index element={<Navigate to="resumo" replace />} />
                  <Route path="resumo" element={<EventSummaryPage />} />
                  <Route path="gerar-folhas" element={<EventGenerateSheetsPage />} />
                  <Route path="folhas" element={<EventSheetsManagePage />} />
                  <Route path="controle-vendas" element={<EventSalesControlPage />} />
                  <Route path="sorteio" element={<EventDrawPage />} />
                  <Route path="vitorias" element={<EventValidationPage />} />
                  <Route path="cartelas" element={<LegacySegRedirect to="gerar-folhas" />} />
                  <Route path="vendas" element={<LegacySegRedirect to="controle-vendas" />} />
                  <Route path="validacao" element={<LegacySegRedirect to="vitorias" />} />
                </Route>
                {/* Documentação temporariamente desativada
                <Route path="/app/ajuda" element={<HelpPage />} />
                */}
              </Route>
            </Route>
            <Route path="/" element={<Navigate to="/app" replace />} />
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Routes>
        </DashboardEventProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
