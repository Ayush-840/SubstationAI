# TRD — Strong Authentication for SubstationIQ (register, login, sessions, MFA)

| | |
|---|---|
| Version | 1.0 — 27 Oct 2026 |
| Builds on | `main` @ `8b3570b` + `substationai-deploy-fix.patch` |
| Audience | You (implementer), your team of 3 (viva), interviewers (PPO/PPI) |
| Legend | ✅ already implemented and tested in the patch · 🔨 to build in this TRD |

---

## 1. Why this document exists

Register/login "did not work properly" for four different reasons at once (browser blocked by CORS, a blank page, weak server rules, fragile session handling). The patch fixes the baseline. This TRD defines **what "strong" authentication means for this project**, what is still missing, and the order to build it so every day produces a reviewable commit.

**Definition of done for "strong":** an attacker with a leaked password list, a stolen laptop session, or a stolen database dump gets as little as possible, and every security-relevant event leaves a record.

---

## 2. Threat model

| ID | Threat | Example | Control | Status |
|----|--------|---------|---------|--------|
| T1 | Credential stuffing / brute force | Bots try leaked e-mail+password pairs | Per-IP rate limit, per (IP+e-mail) lockout with `Retry-After`, global per-e-mail throttle, MFA | ✅ IP + pair; 🔨 per-e-mail + Redis storage; 🔨 MFA |
| T2 | User enumeration | "No such user" vs "wrong password"; timing difference | One generic message, dummy hash on unknown e-mail, identical 429 behaviour | ✅ |
| T3 | Weak passwords | `12345678` | Length 8–128, ≤ 72 bytes, letter+digit, common-password list; 🔨 breached-password check | ✅ / 🔨 |
| T4 | Stolen database | Hashes leaked | Slow salted hash, refresh tokens stored only as SHA-256, TOTP secrets encrypted | ✅ bcrypt + hashed refresh; 🔨 argon2id, 🔨 encrypted TOTP |
| T5 | XSS steals a token | Injected script reads storage | Access token in memory only (15 min); strict CSP; refresh token rotates | ✅ |
| T6 | Refresh-token theft / replay | Copied token used after the user | Rotation, replay detection → revoke all sessions, 🔨 token families + device list | ✅ replay; 🔨 families |
| T7 | Privilege escalation | Public sign-up posts `"role":"admin"` | Role is never read from sign-up input; role changes admin-only and audited | ✅ sign-up; 🔨 audit |
| T8 | Account takeover through reset | Attacker triggers a reset e-mail | Single-use, 30-min, hashed reset tokens; generic response; revoke sessions on reset | 🔨 |
| T9 | Fake accounts | Sign up with someone else's e-mail | E-mail verification before first sign-in | 🔨 |
| T10 | CSRF | Third-party page triggers actions | Bearer header (not cookie) transport; CORS allow-list; CSRF double-submit kept for the cookie flow | ✅ |
| T11 | MITM / downgrade | Public Wi-Fi | HTTPS only, HSTS in production | ✅ |
| T12 | Session never ends | Logout doesn't revoke | Logout deny-lists the access `jti` and revokes the refresh token; works with an expired token | ✅ |
| T13 | Lockout abuse (DoS) | Attacker locks a real user out | Lock per (IP + e-mail), not per e-mail alone; expiring (15 min) not permanent | ✅ |
| T14 | Insider / audit gap | "Who changed this role?" | Append-only `auth_events` | 🔨 |

---

## 3. Architecture decisions (with the reason, for your viva)

| Decision | Choice | Reason / trade-off |
|----------|--------|--------------------|
| Access token | JWT HS256, **15 min**, claims `sub, jti, iat, exp, typ=access`, held **in memory** | Short life limits damage if stolen; memory storage is unreachable by a later page load |
| Refresh token | Opaque 256-bit random, **7 days**, rotated on every use, only SHA-256 stored, sent in the request body | SPA (Vercel) and API (Render) are different sites, so an HttpOnly cookie would be blocked as third-party. Cost: readable by XSS → mitigated with CSP, rotation, replay detection |
| Transport | `Authorization: Bearer` | No ambient credentials → CSRF largely irrelevant |
| Password hash | **argon2id** (m = 19 MiB, t = 2, p = 1 — the OWASP minimum), with transparent re-hash on login from bcrypt | Memory-hard; bcrypt silently ignores bytes after 72, argon2 does not |
| MFA | **TOTP** (RFC 6238, 6 digits, 30 s, ±1 step) + 10 single-use recovery codes | Works offline with any authenticator app, no SMS cost |
| E-mail | Provider behind one interface: `console` (dev/tests), SMTP/Resend/Brevo (prod free tiers) | Tests never send real mail |
| Rate-limit store | Redis when reachable, memory otherwise | Survives restarts and multiple instances |
| Authorization | Role checked **on the server** in a dependency (`require_role`); the UI hiding a tab is cosmetic | Never trust the client |

---

## 4. Data model changes (one Alembic migration per phase)

```text
users            + email_verified_at  DATETIME NULL
                 + password_changed_at DATETIME
                 + totp_secret_enc    TEXT NULL        -- Fernet-encrypted
                 + totp_enabled       BOOL DEFAULT 0
                 + is_active          BOOL DEFAULT 1   -- admin can disable
                 UNIQUE INDEX ON lower(email)

refresh_tokens   + family_id   CHAR(32)     -- all rotations of one login share it
                 + user_agent  VARCHAR(200)
                 + ip          VARCHAR(45)
                 + last_used_at DATETIME

one_time_tokens  id, user_id, purpose ('verify_email'|'reset_password'),
                 token_hash CHAR(64) UNIQUE, expires_at, used_at

recovery_codes   id, user_id, code_hash, used_at

auth_events      id, user_id NULL, event, ip, user_agent, detail JSON, created_at
                 -- append-only; no UPDATE/DELETE in the code base
```

`event` values: `register`, `login_ok`, `login_fail`, `lockout`, `refresh`, `refresh_replay`, `logout`, `logout_all`, `password_change`, `password_reset_request`, `password_reset_done`, `email_verified`, `mfa_enabled`, `mfa_disabled`, `mfa_fail`, `role_change`, `account_disabled`.

---

## 5. API contract

All errors use `{"detail": "..."}`. 401 = not authenticated, 403 = not allowed, 409 = conflict, 422 = invalid input, 429 = throttled (always with `Retry-After`).

### 5.1 Already built ✅
| Endpoint | Success | Notes |
|----------|---------|-------|
| `POST /api/auth/register` | 201 user (role always `trainee`) | 409 duplicate (case-insensitive), 422 weak input |
| `POST /api/auth/login` | 200 `{access_token, refresh_token, token_type}` | generic 401; 429 after 5 failures per IP+e-mail in 15 min |
| `POST /api/auth/refresh` | 200 new pair, old token revoked | replay after 10 s grace → all sessions revoked |
| `POST /api/auth/logout` | 200, idempotent | works with an expired access token |
| `GET /api/auth/me` | 200 | |

### 5.2 To build 🔨
| Endpoint | Behaviour |
|----------|-----------|
| `POST /api/auth/verify-email` `{token}` | marks `email_verified_at`; token single-use, 24 h |
| `POST /api/auth/resend-verification` `{email}` | always 202 (no enumeration); max 3/hour |
| `POST /api/auth/login` (changed) | if `email_verified_at` is null → 403 `email_not_verified`; if `totp_enabled` → 200 `{mfa_required:true, mfa_token}` (5-min, purpose-bound JWT, **no** access token yet) |
| `POST /api/auth/mfa/verify` `{mfa_token, code}` | accepts TOTP or a recovery code → returns the normal token pair; 5 wrong codes → 15-min lock |
| `POST /api/auth/mfa/setup` | returns `otpauth://` URI + secret (shown once); not active until confirmed |
| `POST /api/auth/mfa/enable` `{code}` | confirms with a first valid code; returns 10 recovery codes (shown once) |
| `POST /api/auth/mfa/disable` `{password, code}` | re-authentication required |
| `POST /api/auth/password/forgot` `{email}` | always 202; sends reset link if the account exists |
| `POST /api/auth/password/reset` `{token, new_password}` | single-use, 30 min, hashed token; **revokes every session**; logs event |
| `POST /api/auth/password/change` `{current_password, new_password}` | re-auth; revokes all *other* sessions |
| `GET /api/auth/sessions` / `DELETE /api/auth/sessions/{family_id}` / `POST /api/auth/logout-all` | list devices (UA, IP, last used), revoke one or all |
| `PATCH /api/admin/users/{id}` `{role?, is_active?}` | admin only; cannot demote the last admin; writes `role_change` / `account_disabled` |
| `GET /api/admin/auth-events?user_id=&event=&limit=` | admin only, paginated |

---

## 6. Detailed rules

**Passwords**
* Policy (unchanged): 8–128 chars, ≤ 72 UTF-8 bytes while bcrypt is in use (lift the byte cap once every hash is argon2), ≥ 1 letter and ≥ 1 digit, not in the common list, not equal to the e-mail/name.
* 🔨 Breached-password check using the k-anonymity range API (send only the first 5 hash characters). **Fail open** if the service is unreachable — registration must not depend on a third party.
* 🔨 Hash migration: on a successful login with a bcrypt hash, re-hash with argon2id and store it. The two formats are told apart by their prefix.

**Lockout / throttling** (all values come from settings)
| Scope | Limit | Window | Response |
|-------|-------|--------|----------|
| IP, any `/auth/*` write | 30 requests | 1 min | 429 |
| (IP + e-mail) failures | 5 | 15 min | 429 + `Retry-After` |
| e-mail failures from any IP | 20 | 1 h | CAPTCHA-style delay: add 1 s × excess, never a hard lock |
| MFA code failures per `mfa_token` | 5 | 15 min | 429 |
| Reset / verification mails per e-mail | 3 | 1 h | silently dropped, still 202 |

**Tokens**
* One-time tokens: 32 random bytes, URL-safe; store SHA-256 only; compare with `hmac.compare_digest`; mark `used_at` in the same transaction that applies the change.
* Refresh family: login creates `family_id`; each rotation keeps it. Replay of a used token revokes the **family** (that device) and records `refresh_replay`; replay after the grace window revokes **all** of the user's sessions (current behaviour, kept).
* Access token carries no role; the server loads the user on each request, so a demoted admin loses access within one request, not 15 minutes later. (Cost: one indexed query per request — acceptable; cache in Redis for 30 s if it ever shows in profiling.)

**Disabled / unverified users** are rejected at login, refresh, and in `get_current_user`.

**Headers (frontend host and API)**
`Content-Security-Policy: default-src 'self'; connect-src 'self' https://<api-host>; img-src 'self' data:; frame-ancestors 'none'` on Vercel (`frontend/vercel.json` → `headers`). API already sends `nosniff`, `X-Frame-Options`, `Referrer-Policy`, HSTS (production), `Cache-Control: no-store` on `/api/auth/*`.

---

## 7. Frontend requirements

1. Login page: one responsive form ✅; show lockout countdown from `Retry-After` 🔨; "Forgot password?" link 🔨.
2. Register page: live password checklist (length, letter+digit, not common) 🔨; "check your e-mail" screen 🔨.
3. MFA step: 6-digit input with `autocomplete="one-time-code"`, "use a recovery code" fallback 🔨.
4. Account page: change password, enable/disable MFA with QR code, list and revoke sessions 🔨.
5. Session client ✅: in-memory access token, single-flight refresh, sign out only on a genuine auth failure, readable messages, wake-up notice for Render cold starts.
6. Never log tokens or passwords; never put them in a URL (reset/verify links carry the token in the **fragment or a POST body**, not a query string that is logged).

---

## 8. Test matrix (acceptance criteria)

Existing ✅: 25 auth/CORS tests inside the 131 passing tests. New 🔨 tests, each one named after the threat it covers:

| ID | Test | Expect |
|----|------|--------|
| A-01 | register with role `admin` in the body | created as `trainee` |
| A-02 | unverified user logs in | 403 `email_not_verified` |
| A-03 | verify token used twice / after expiry | 400 second time / 400 |
| A-04 | forgot-password for unknown and known e-mail | identical 202 body and similar latency |
| A-05 | reset token reuse | 400; all refresh tokens revoked after a successful reset |
| A-06 | MFA: valid TOTP, TOTP one step old, two steps old, replayed code | accept, accept, reject, reject (a code is single-use) |
| A-07 | recovery code used twice | second use rejected |
| A-08 | `mfa_token` presented as an access token | 401 (purpose-bound) |
| A-09 | change password | other sessions revoked, current session kept |
| A-10 | bcrypt user logs in | hash upgraded to argon2id, login still works |
| A-11 | demote an admin | their next request is 403 without waiting for expiry |
| A-12 | demote the last admin | 409 |
| A-13 | every flow above | exactly one `auth_events` row with the right `event` |
| A-14 | concurrent refresh with the same token (race) | one succeeds, other gets the grace-window response, no session wipe |

Manual checks for the viva: use Google Authenticator against your own account; open two browsers, revoke one from the sessions list and watch it get signed out on its next refresh.

---

## 9. Build plan — 10 working days, one commit per bullet

| Day | Deliverable | Commit message (example) |
|-----|-------------|--------------------------|
| 1 | `auth_events` table + `log_event()`; call it from existing flows | `feat(auth): append-only audit log for sign-in events` |
| 2 | argon2id hasher + transparent upgrade (A-10) | `feat(auth): argon2id with rehash-on-login` |
| 3 | `one_time_tokens`, mail interface with `console` backend | `feat(auth): one-time token store and mail interface` |
| 4 | Register → verify e-mail → login gate (A-02, A-03) | `feat(auth): e-mail verification` |
| 5 | Forgot / reset password (A-04, A-05) | `feat(auth): password reset with session revocation` |
| 6 | Refresh families + sessions list/revoke + logout-all (A-14) | `feat(auth): device sessions and per-device revoke` |
| 7 | TOTP enrol / enable / disable + recovery codes (A-06, A-07) | `feat(auth): TOTP two-factor authentication` |
| 8 | MFA login step and `mfa_token` (A-08) | `feat(auth): MFA challenge on login` |
| 9 | Frontend: account page, MFA UI, reset pages, password checklist | `feat(ui): account security page` |
| 10 | Admin user management + audit viewer (A-11, A-12), CSP header, README security section, record demo video | `feat(admin): role management with audit trail` |

Dependencies to add: `argon2-cffi`, `pyotp`, `cryptography` (Fernet), `qrcode` is **not** needed (render the `otpauth://` URI as a QR on the client).

Environment variables: `TOTP_ENCRYPTION_KEY` (Fernet key), `MAIL_BACKEND` (`console|smtp|resend`), `MAIL_FROM`, `SMTP_*` / `RESEND_API_KEY`, `APP_BASE_URL`, `REQUIRE_EMAIL_VERIFICATION` (`false` in dev). `assert_production_ready()` must refuse to start in production without `TOTP_ENCRYPTION_KEY` and a real mail backend when verification is required.

---

## 10. Risks and open decisions

| Item | Note |
|------|------|
| E-mail on free hosting | Render's free tier blocks outbound SMTP on some ports; use an HTTPS API provider (Resend/Brevo free tiers) — decide on Day 3 |
| Demo accounts | They bypass verification/MFA by design in **development only**; production refuses to start with `SEED_DEMO_USERS=true` ✅ |
| Lock-out of the only admin | Recovery path = a CLI script `python -m app.scripts.make_admin <email>` (offline, server-side), documented in the README |
| Scope creep | OAuth/Google sign-in, WebAuthn passkeys, SMS OTP are **out of scope**; mention them as future work |

---

## 11. Interview / viva answers this design lets you give

* **"Why not store the JWT in localStorage?"** The access token never touches storage; the refresh token has to live somewhere cross-site, so it rotates and replay revokes the family.
* **"What happens if the refresh token is stolen?"** First use by either party wins; the second is detected as replay, the family is revoked, the event is logged and the user must sign in again.
* **"Why argon2id over bcrypt?"** Memory-hard (GPU/ASIC-resistant) and no 72-byte truncation; we upgrade hashes transparently at login so no forced reset.
* **"How do you stop user enumeration?"** Same message, same status, dummy hash for unknown e-mails, always-202 for reset and resend.
* **"Why isn't the role in the token?"** So a demotion applies immediately; we trade one indexed query per request for that.
* **"How did you verify it?"** 131 automated tests plus a headless-browser run of register → reload → logout → wrong password → expired-token refresh.
