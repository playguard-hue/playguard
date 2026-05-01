import { useState } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Sidebar from './components/Sidebar'
import HomePage from './pages/HomePage'
import LimitsPage from './pages/LimitsPage'
import SettingsPage from './pages/SettingsPage'
import LoginPage from './pages/LoginPage'

export type Page = 'home' | 'limits' | 'settings'

function MainApp() {
  const [currentPage, setCurrentPage] = useState<Page>('home')

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <HomePage />
      case 'limits':
        return <LimitsPage />
      case 'settings':
        return <SettingsPage />
    }
  }

  return (
    <div className="flex h-screen w-screen bg-bg text-white overflow-hidden">
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <main className="flex-1 overflow-y-auto">{renderPage()}</main>
    </div>
  )
}

function AppRouter() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-bg text-white/40">
        Loading...
      </div>
    )
  }

  return user ? <MainApp /> : <LoginPage />
}

function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  )
}

export default App