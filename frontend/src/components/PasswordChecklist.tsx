/**
 * Live password-rule checklist — mirrors backend schemas.check_password_policy
 * so users see what is required before submitting (AUTH_TRD §7.4).
 */

// Same small blocklist the server rejects (schemas.COMMON_PASSWORDS).
const COMMON = [
  'password', 'password1', 'password12', 'password123', 'password1234',
  'passw0rd', 'passw0rd1', 'qwerty123', 'qwerty1234', 'abc12345', 'abcd1234',
  'iloveyou1', 'welcome1', 'welcome123', 'admin123', 'admin1234', 'letmein1',
  '12345678a', 'a1234567', '1q2w3e4r', 'test1234', 'changeme1',
]

export interface PasswordRule {
  label: string
  ok: boolean
}

export function passwordRules(password: string): PasswordRule[] {
  const lower = password.toLowerCase()
  return [
    { label: 'At least 8 characters', ok: password.length >= 8 },
    {
      label: 'A letter and a number',
      ok: /[A-Za-z]/.test(password) && /\d/.test(password),
    },
    { label: 'Not a common password', ok: password.length > 0 && !COMMON.includes(lower) },
    {
      label: 'At most 72 bytes',
      ok: password.length === 0 || new TextEncoder().encode(password).length <= 72,
    },
  ]
}

/** First failing rule as a sentence, or null when everything passes. */
export function firstPasswordProblem(password: string): string | null {
  const bad = passwordRules(password).find((r) => !r.ok)
  if (!bad) return null
  if (bad.label === 'At least 8 characters') return 'Password must be at least 8 characters.'
  if (bad.label === 'A letter and a number') return 'Password must contain at least one letter and one number.'
  if (bad.label === 'Not a common password') return 'That password is too common — pick something less guessable.'
  return 'Password is too long (72 bytes maximum).'
}

export function PasswordChecklist({ password }: { password: string }) {
  const rules = passwordRules(password)
  return (
    <ul
      aria-label="Password requirements"
      style={{ listStyle: 'none', margin: '6px 0 0', padding: 0, display: 'grid', gap: 2 }}
    >
      {rules.map((r) => (
        <li
          key={r.label}
          style={{
            fontSize: 12,
            color: r.ok ? 'var(--success, #15803d)' : 'var(--muted)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span aria-hidden style={{ width: 12, display: 'inline-block' }}>{r.ok ? '✓' : '·'}</span>
          {r.label}
        </li>
      ))}
    </ul>
  )
}
