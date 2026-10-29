import { FormEvent, useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import QRCode from 'qrcode'
import { useAuth } from '../auth'
import {
  api,
  ApiError,
  getRefreshToken,
  listSessions,
  logoutAllRemote,
  revokeSessionRemote,
  setStoredUser,
  type SessionInfo,
} from '../api/client'
import { Field, Input, Button } from '../components/common'
import { PasswordChecklist, firstPasswordProblem } from '../components/PasswordChecklist'
import type { User } from '../types'

type Flash = { ok: boolean; text: string } | null

const sectionStyle: React.CSSProperties = {
  borderTop: '1px solid var(--rule)',
  paddingTop: 20,
  marginTop: 24,
}

const headingStyle: React.CSSProperties = {
  margin: '0 0 4px',
  fontSize: 16,
  fontWeight: 600,
  fontFamily: 'var(--font-display)',
}

const mutedSmall: React.CSSProperties = { fontSize: 13, color: 'var(--muted)', margin: '0 0 12px' }

function when(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString()
}

export default function Account() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [profile, setProfile] = useState<User | null>(user)
  const refreshProfile = useCallback(async () => {
    try {
      const me = await api.get<User>('/api/auth/me')
      setProfile(me)
      setStoredUser(me)
    } catch { /* keep the cached copy */ }
  }, [])

  // ── change password ────────────────────────────────────────────────────────
  const [curPw, setCurPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [pwFlash, setPwFlash] = useState<Flash>(null)
  const [pwBusy, setPwBusy] = useState(false)

  const submitPassword = async (e: FormEvent) => {
    e.preventDefault()
    if (pwBusy) return
    setPwFlash(null)
    const problem = firstPasswordProblem(newPw)
    if (problem) return setPwFlash({ ok: false, text: problem })
    if (!curPw) return setPwFlash({ ok: false, text: 'Enter your current password.' })
    setPwBusy(true)
    try {
      const refresh_token = getRefreshToken()
      await api.post('/api/auth/password/change', {
        current_password: curPw,
        new_password: newPw,
        ...(refresh_token ? { refresh_token } : {}),
      })
      setPwFlash({ ok: true, text: 'Password changed. Your other sessions were signed out; this one stays signed in.' })
      setCurPw('')
      setNewPw('')
    } catch (err) {
      setPwFlash({ ok: false, text: err instanceof ApiError ? err.message : 'Could not reach the server.' })
    } finally {
      setPwBusy(false)
    }
  }

  // ── two-factor (TOTP) ──────────────────────────────────────────────────────
  const [mfaStage, setMfaStage] = useState<'idle' | 'setup' | 'codes'>('idle')
  const [mfaBusy, setMfaBusy] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [mfaSecret, setMfaSecret] = useState('')
  const [mfaOtpauth, setMfaOtpauth] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [mfaFlash, setMfaFlash] = useState<Flash>(null)
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [disablePw, setDisablePw] = useState('')
  const [disableCode, setDisableCode] = useState('')
  const [copied, setCopied] = useState(false)

  const startMfaSetup = async () => {
    setMfaFlash(null)
    setMfaBusy(true)
    try {
      const res = await api.post<{ secret: string; otpauth_uri: string }>('/api/auth/mfa/setup')
      setMfaSecret(res.secret)
      setMfaOtpauth(res.otpauth_uri)
      // The QR is rendered locally — the otpauth URI contains the secret and
      // must never leave the browser through a third-party image service.
      const dataUrl = await QRCode.toDataURL(res.otpauth_uri, { margin: 1, width: 220 })
      setQrDataUrl(dataUrl)
      setMfaCode('')
      setMfaStage('setup')
    } catch (err) {
      setMfaFlash({ ok: false, text: err instanceof ApiError ? err.message : 'Could not reach the server.' })
    } finally {
      setMfaBusy(false)
    }
  }

  const confirmMfa = async (e: FormEvent) => {
    e.preventDefault()
    if (mfaBusy) return
    setMfaFlash(null)
    setMfaBusy(true)
    try {
      const res = await api.post<{ recovery_codes: string[] }>('/api/auth/mfa/enable', { code: mfaCode.trim() })
      setRecoveryCodes(res.recovery_codes)
      setMfaStage('codes')
      setMfaCode('')
      await refreshProfile()
    } catch (err) {
      setMfaFlash({ ok: false, text: err instanceof ApiError ? err.message : 'Could not reach the server.' })
    } finally {
      setMfaBusy(false)
    }
  }

  const disableMfa = async (e: FormEvent) => {
    e.preventDefault()
    if (mfaBusy) return
    setMfaFlash(null)
    setMfaBusy(true)
    try {
      await api.post('/api/auth/mfa/disable', { password: disablePw, code: disableCode.trim() })
      setDisablePw('')
      setDisableCode('')
      setMfaFlash({ ok: true, text: 'Two-factor authentication is off.' })
      await refreshProfile()
    } catch (err) {
      setMfaFlash({ ok: false, text: err instanceof ApiError ? err.message : 'Could not reach the server.' })
    } finally {
      setMfaBusy(false)
    }
  }

  // ── sessions ───────────────────────────────────────────────────────────────
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [sessionsError, setSessionsError] = useState('')
  const [revoking, setRevoking] = useState<string | null>(null)

  const loadSessions = useCallback(async () => {
    try {
      setSessions(await listSessions())
      setSessionsError('')
    } catch (err) {
      setSessionsError(err instanceof ApiError ? err.message : 'Could not load sessions.')
    }
  }, [])

  useEffect(() => { void loadSessions() }, [loadSessions])

  const revoke = async (familyId: string) => {
    setRevoking(familyId)
    try {
      await revokeSessionRemote(familyId)
      await loadSessions()
    } catch (err) {
      setSessionsError(err instanceof ApiError ? err.message : 'Could not revoke that session.')
    } finally {
      setRevoking(null)
    }
  }

  const signOutEverywhere = async () => {
    if (!window.confirm('Sign out on every device, including this one?')) return
    try { await logoutAllRemote() } catch { /* local sign-out still happens */ }
    logout()
    navigate('/login')
  }

  // ── verification ───────────────────────────────────────────────────────────
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const resendVerification = async () => {
    if (resendState !== 'idle' || !profile) return
    setResendState('sending')
    try {
      await api.post('/api/auth/resend-verification', { email: profile.email })
      setResendState('sent')
    } catch {
      setResendState('idle')
    }
  }

  const copyCodes = async () => {
    try {
      await navigator.clipboard.writeText(recoveryCodes.join('\n'))
      setCopied(true)
    } catch { /* clipboard blocked */ }
  }

  const verified = Boolean(profile?.email_verified_at)
  const mfaEnabled = Boolean(profile?.totp_enabled)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 600, fontFamily: 'var(--font-display)' }}>
        Account &amp; security
      </h1>
      <p style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--muted)' }}>
        {profile?.name} · {profile?.email}
      </p>

      {/* ── Profile ──────────────────────────────────────────────────────── */}
      <section style={{ ...sectionStyle, borderTop: 'none', paddingTop: 8 }}>
        <h2 style={headingStyle}>Profile</h2>
        <p style={mutedSmall}>
          Role: <strong>{profile?.role ?? '—'}</strong>
          {' · '}
          {verified ? (
            <span style={{ color: 'var(--success, #15803d)' }}>e-mail verified</span>
          ) : (
            <span style={{ color: 'var(--warning, #b45309)' }}>e-mail not verified</span>
          )}
        </p>
        {!verified && (
          <p style={{ fontSize: 13 }}>
            {resendState === 'sent' ? (
              <span style={{ color: 'var(--success, #15803d)' }} role="status">Confirmation e-mail sent.</span>
            ) : (
              <Button variant="secondary" disabled={resendState === 'sending'} onClick={resendVerification}>
                {resendState === 'sending' ? 'Sending…' : 'Resend confirmation e-mail'}
              </Button>
            )}
          </p>
        )}
      </section>

      {/* ── Change password ──────────────────────────────────────────────── */}
      <section style={sectionStyle}>
        <h2 style={headingStyle}>Change password</h2>
        <p style={mutedSmall}>Requires your current password. Other sessions are signed out afterwards.</p>
        <form onSubmit={submitPassword} noValidate style={{ maxWidth: 380 }}>
          <Field label="Current password" htmlFor="acct-cur" required>
            <Input id="acct-cur" type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} autoComplete="current-password" />
          </Field>
          <Field label="New password" htmlFor="acct-new" required>
            <Input id="acct-new" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" />
          </Field>
          {newPw.length > 0 && <PasswordChecklist password={newPw} />}
          {pwFlash && (
            <p role={pwFlash.ok ? 'status' : 'alert'} style={{ margin: '10px 0', fontSize: 13, color: pwFlash.ok ? 'var(--success, #15803d)' : 'var(--danger)' }}>
              {pwFlash.text}
            </p>
          )}
          <Button variant="primary" type="submit" disabled={pwBusy} style={{ marginTop: 12 }}>
            {pwBusy ? 'Saving…' : 'Change password'}
          </Button>
        </form>
      </section>

      {/* ── Two-factor ───────────────────────────────────────────────────── */}
      <section style={sectionStyle}>
        <h2 style={headingStyle}>Two-factor authentication</h2>
        <p style={mutedSmall}>
          {mfaEnabled
            ? 'On — every sign-in additionally needs a code from your authenticator app (or a recovery code).'
            : 'Off — add a second step with an authenticator app (Google Authenticator, Authy, 1Password…).'}
        </p>

        {mfaFlash && (
          <p role={mfaFlash.ok ? 'status' : 'alert'} style={{ margin: '0 0 12px', fontSize: 13, color: mfaFlash.ok ? 'var(--success, #15803d)' : 'var(--danger)' }}>
            {mfaFlash.text}
          </p>
        )}

        {!mfaEnabled && mfaStage === 'idle' && (
          <Button variant="primary" disabled={mfaBusy} onClick={startMfaSetup}>
            {mfaBusy ? 'Preparing…' : 'Enable two-factor'}
          </Button>
        )}

        {!mfaEnabled && mfaStage === 'setup' && (
          <form onSubmit={confirmMfa} noValidate style={{ display: 'grid', gap: 12, maxWidth: 420 }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
              Scan the QR code with your authenticator app, then enter the 6-digit code it shows to confirm.
              No camera? Use the setup key below.
            </p>
            {qrDataUrl && (
              <img src={qrDataUrl} alt="Authenticator QR code" width={220} height={220} style={{ borderRadius: 'var(--radius-sm)', background: '#fff', padding: 8, alignSelf: 'start' }} />
            )}
            <p style={{ margin: 0, fontSize: 13 }}>
              <span style={{ color: 'var(--muted)' }}>Setup key: </span>
              <code style={{ fontFamily: 'var(--font-data)', fontSize: 13, letterSpacing: '0.06em', userSelect: 'all' }}>{mfaSecret}</code>
            </p>
            <Field label="Confirmation code" htmlFor="mfa-confirm" required>
              <Input
                id="mfa-confirm"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                maxLength={12}
                style={{ letterSpacing: '0.15em' }}
              />
            </Field>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="primary" type="submit" disabled={mfaBusy || mfaCode.trim().length < 6}>
                {mfaBusy ? 'Confirming…' : 'Turn on'}
              </Button>
              <Button variant="tertiary" type="button" disabled={mfaBusy} onClick={() => { setMfaStage('idle'); setMfaFlash(null) }}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        {mfaStage === 'codes' && (
          <div style={{ maxWidth: 460 }}>
            <p style={{ margin: '0 0 8px', fontSize: 14 }}>
              Two-factor is on. Save these recovery codes somewhere safe — each works once if you lose
              your authenticator. They are shown only now.
            </p>
            <ul style={{ margin: '0 0 12px', padding: '8px 12px', listStyle: 'none', background: 'var(--surface-sunken)', border: '1px solid var(--rule)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-data)', fontSize: 14, display: 'grid', gap: 4 }}>
              {recoveryCodes.map((c) => <li key={c}>{c}</li>)}
            </ul>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="secondary" onClick={copyCodes}>{copied ? 'Copied' : 'Copy codes'}</Button>
              <Button variant="primary" onClick={() => { setMfaStage('idle'); setRecoveryCodes([]); setCopied(false) }}>
                I saved them
              </Button>
            </div>
          </div>
        )}

        {mfaEnabled && (
          <form onSubmit={disableMfa} noValidate style={{ display: 'grid', gap: 12, maxWidth: 380 }}>
            <Field label="Password (re-authenticate)" htmlFor="mfa-pw" required>
              <Input id="mfa-pw" type="password" value={disablePw} onChange={(e) => setDisablePw(e.target.value)} autoComplete="current-password" />
            </Field>
            <Field label="Authenticator or recovery code" htmlFor="mfa-code-off" required>
              <Input id="mfa-code-off" type="text" autoComplete="one-time-code" value={disableCode} onChange={(e) => setDisableCode(e.target.value)} maxLength={32} />
            </Field>
            <Button variant="destructive" type="submit" disabled={mfaBusy} style={{ justifySelf: 'start' }}>
              {mfaBusy ? 'Turning off…' : 'Turn off two-factor'}
            </Button>
          </form>
        )}
      </section>

      {/* ── Sessions ─────────────────────────────────────────────────────── */}
      <section style={sectionStyle}>
        <h2 style={headingStyle}>Signed-in devices</h2>
        <p style={mutedSmall}>One entry per browser. Revoking a device signs it out everywhere.</p>
        {sessionsError && (
          <p role="alert" style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--danger)' }}>{sessionsError}</p>
        )}
        {sessions.length === 0 && !sessionsError && (
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>No active sessions found.</p>
        )}
        <div style={{ display: 'grid', gap: 8, maxWidth: 560 }}>
          {sessions.map((s) => (
            <div
              key={s.family_id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                border: '1px solid var(--rule)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--surface)',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.user_agent || 'Unknown device'}
                  </span>
                  {s.current && (
                    <span style={{ flexShrink: 0, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--success, #15803d)', border: '1px solid currentColor', borderRadius: 'var(--radius-sm)', padding: '0 5px' }}>
                      This device
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {s.ip || 'unknown IP'} · last active {when(s.last_used_at)}
                </div>
              </div>
              {!s.current && (
                <Button variant="tertiary" disabled={revoking === s.family_id} onClick={() => revoke(s.family_id)}>
                  {revoking === s.family_id ? 'Revoking…' : 'Revoke'}
                </Button>
              )}
            </div>
          ))}
        </div>
        <Button variant="destructive" style={{ marginTop: 16 }} onClick={signOutEverywhere}>
          Sign out everywhere
        </Button>
      </section>

      {/* ── Session ──────────────────────────────────────────────────────── */}
      <section style={sectionStyle}>
        <h2 style={headingStyle}>This session</h2>
        <Button variant="secondary" onClick={() => { logout(); navigate('/login') }}>
          Sign out
        </Button>
      </section>
    </div>
  )
}
