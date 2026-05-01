interface PasswordStrengthProps {
  password: string
}

export interface PasswordCheck {
  label: string
  test: (pw: string) => boolean
}

export const passwordChecks: PasswordCheck[] = [
  { label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
  { label: 'One uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
  { label: 'One lowercase letter', test: (pw) => /[a-z]/.test(pw) },
  { label: 'One number', test: (pw) => /\d/.test(pw) },
  { label: 'One special character', test: (pw) => /[^A-Za-z0-9]/.test(pw) }
]

export function isPasswordValid(pw: string): boolean {
  return passwordChecks.every((c) => c.test(pw))
}

function PasswordStrength({ password }: PasswordStrengthProps) {
  const passedCount = passwordChecks.filter((c) => c.test(password)).length
  const strength = passedCount / passwordChecks.length

  // Color based on strength
  const barColor =
    strength < 0.4
      ? 'bg-red-500'
      : strength < 0.8
        ? 'bg-yellow-500'
        : 'bg-green-500'

  return (
    <div className="mt-2 space-y-2">
      {/* Strength bar */}
      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-200 ${barColor}`}
          style={{ width: `${strength * 100}%` }}
        />
      </div>

      {/* Checklist */}
      <ul className="space-y-1">
        {passwordChecks.map((check) => {
          const passed = check.test(password)
          return (
            <li
              key={check.label}
              className={`flex items-center gap-2 text-xs transition-colors ${
                passed ? 'text-green-400' : 'text-white/40'
              }`}
            >
              <span className="w-3 text-center">{passed ? '✓' : '○'}</span>
              <span>{check.label}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default PasswordStrength