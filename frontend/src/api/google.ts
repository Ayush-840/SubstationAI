/**
 * Google Identity Services loader (sign-in button + ID-token callback).
 *
 * The script is loaded lazily and only when a client id is configured at
 * build time (VITE_GOOGLE_CLIENT_ID). The `credential` JWT it produces is
 * sent to our API, which verifies it server-side — the frontend never
 * treats it as proof by itself.
 */

export const GOOGLE_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

export const googleEnabled = Boolean(GOOGLE_CLIENT_ID)

let scriptPromise: Promise<void> | null = null

/** Inject the GIS script once; resolves when window.google is available. */
export function loadGoogleScript(): Promise<void> {
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const w = window as any
    if (w.google?.accounts?.id) return resolve()
    const existing = document.querySelector<HTMLScriptElement>('script[data-gis]')
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Google script failed to load')))
      return
    }
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.defer = true
    s.dataset.gis = 'true'
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Google script failed to load'))
    document.head.appendChild(s)
  })
  return scriptPromise
}

interface GisButtonOptions {
  theme?: 'outline' | 'filled_black' | 'filled_blue'
  size?: 'large' | 'medium' | 'small'
  text?: 'signin_with' | 'continue_with' | 'signup_with'
  width?: number
}

/** Render the official button into `element`; calls `onCredential` with the ID token. */
export async function renderGoogleButton(
  element: HTMLElement,
  onCredential: (idToken: string) => void,
  options: GisButtonOptions = {},
): Promise<void> {
  await loadGoogleScript()
  const w = window as any
  if (!w.google?.accounts?.id) throw new Error('Google Sign-In is unavailable')
  w.google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: (resp: { credential?: string }) => {
      if (resp.credential) onCredential(resp.credential)
    },
  })
  w.google.accounts.id.renderButton(element, {
    theme: options.theme ?? 'outline',
    size: options.size ?? 'large',
    text: options.text ?? 'signin_with',
    width: options.width ?? 320,
  })
}
