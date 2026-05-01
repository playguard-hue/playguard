import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { User } from '../../../preload/index.d'

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // On mount: check if we already have a saved session
  useEffect(() => {
    window.api.auth.getCurrentUser().then((u) => {
      setUser(u)
      setLoading(false)
    })
  }, [])

  const login = async (email: string, password: string): Promise<void> => {
    const u = await window.api.auth.login(email, password)
    setUser(u)
  }

  const register = async (
    email: string,
    username: string,
    password: string
  ): Promise<void> => {
    const u = await window.api.auth.register(email, username, password)
    setUser(u)
  }

  const logout = async (): Promise<void> => {
    await window.api.auth.logout()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}