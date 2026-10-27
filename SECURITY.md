# Security Policy

## Reporting a vulnerability

Open a private security advisory on this repository (Security → Report a
vulnerability) or e-mail the maintainers. Do not open a public issue for
exploitable bugs. You will get a response within 3 working days.

## Supported versions

The deployed `main` branch on Render + Vercel is the only supported version.

## Security design (summary)

Full detail lives in `AUTH_TRD.md` and `DEPLOY_FIX_TRD.md`:

- Access tokens: JWT HS256, 15 minutes, held in memory only.
- Refresh tokens: opaque, 7-day, rotated on every use; replay outside a 10 s
  grace window revokes every session of that user. Only the SHA-256 is stored.
- Passwords: 8–128 characters, letter + digit, common-password deny-list,
  hashed with argon2id (bcrypt transparently upgraded on login).
- Login: generic error message, timing-equalised, per-(IP + e-mail) lockout
  with `Retry-After`; MFA via TOTP when enabled.
- E-mail verification and single-use hashed tokens for verify / password reset.
- Append-only `auth_events` audit log for every security-relevant event.
- CORS: explicit allow-list per environment; `https://*.vercel.app`-style
  wildcards match exactly one DNS label; invalid patterns fail at startup.
- Security headers: `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`,
  HSTS in production, `Cache-Control: no-store` on `/api/auth/*`, CSP on the
  frontend host.

## Production startup refuses unsafe settings

With `APP_ENV=production` the API refuses to boot when `JWT_SECRET` is a
placeholder or shorter than 32 characters, CORS is unset, demo users are
enabled, or (when verification/MFA are required) `TOTP_ENCRYPTION_KEY` or a
real mail backend is missing.
