import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import logo from '../assets/logo.png'
import PasswordStrength, { isPasswordValid } from '../components/PasswordStrength'
import { validateEmail } from '../utils/email'

type Mode = 'login' | 'register'

function LoginPage() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)

    // Email validation (both modes — even for login, weird emails are obviously wrong)
    const emailCheck = validateEmail(email)
    if (!emailCheck.valid) {
      setError(emailCheck.reason)
      return
    }

    // Only enforce password strength on register (login allows existing weak passwords)
    if (mode === 'register' && !isPasswordValid(password)) {
      setError('Password does not meet requirements')
      return
    }

    setSubmitting(true)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register(email, username, password)
      }
      // On success, AuthProvider re-renders App → main UI shows
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-bg relative overflow-hidden">
      {/* Background gradient orbs */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 rounded-full bg-brand-purple/20 blur-[120px]" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 rounded-full bg-brand-cyan/20 blur-[120px]" />

      <div className="relative w-full max-w-md px-8">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img
            src={logo}
            alt="PlayGuard"
            className="w-32 h-32 object-contain mb-2 drop-shadow-[0_0_30px_rgba(139,92,246,0.3)]"
          />
          <p className="text-sm text-white/50 mt-1">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
            required
            autoFocus
          />

          {mode === 'register' && (
            <Field
              label="Username"
              value={username}
              onChange={setUsername}
              placeholder="cooluser"
              required
              minLength={3}
            />
          )}

          <div>
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
              required
              minLength={mode === 'register' ? 8 : 1}
            />
            {mode === 'register' && password.length > 0 && (
              <PasswordStrength password={password} />
            )}
          </div>

          {error && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-gradient-to-r from-brand-purple to-brand-cyan text-white font-medium py-2.5 rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting
              ? 'Please wait...'
              : mode === 'login'
                ? 'Sign in'
                : 'Create account'}
          </button>
        </form>

        {/* Switch mode */}
        <div className="text-center mt-6 text-sm text-white/50">
          {mode === 'login' ? (
            <>
              Don't have an account?{' '}
              <button
                onClick={() => {
                  setMode('register')
                  setError(null)
                }}
                className="text-brand-cyan hover:underline"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                onClick={() => {
                  setMode('login')
                  setError(null)
                }}
                className="text-brand-cyan hover:underline"
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

interface FieldProps {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  required?: boolean
  minLength?: number
  autoFocus?: boolean
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
  minLength,
  autoFocus
}: FieldProps) {
  return (
    <label className="block">
      <div className="text-xs text-white/50 mb-1.5">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        autoFocus={autoFocus}
        className="w-full bg-bg-panel border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brand-purple transition-colors"
      />
    </label>
  )
}

export default LoginPage