// Runs before `vite build` (npm "prebuild"). On Vercel a wrong or missing API URL does not
// fail the build -- it ships a site whose login/register silently talk to the wrong host
// (or get the SPA's index.html back through the catch-all rewrite). Fail here instead.
const env = process.env
const onVercel = env.VERCEL === '1' || env.CI_REQUIRE_API_URL === '1'
const url = (env.VITE_API_URL || '').trim()
const problems = []

if (onVercel && env.ALLOW_EMPTY_API_URL !== '1') {
  if (!url) {
    problems.push('VITE_API_URL is not set. Add it in Vercel -> Project -> Settings -> Environment Variables (your Render backend URL, e.g. https://substationiq-api.onrender.com), then redeploy.')
  } else {
    if (!/^https:\/\//.test(url)) problems.push(`VITE_API_URL must start with https:// (got "${url}").`)
    if (/localhost|127\.0\.0\.1/.test(url)) problems.push(`VITE_API_URL points at localhost ("${url}"); the deployed site cannot reach that.`)
    if (/\/api\/?$/.test(url)) problems.push('VITE_API_URL must be the server root, without a trailing /api (the app adds /api/... itself).')
  }
}

if (problems.length) {
  console.error('\nBuild stopped by scripts/check-env.mjs:\n' + problems.map((p) => '  - ' + p).join('\n') + '\n')
  process.exit(1)
}
if (env.VERCEL_ENV === 'production' && env.VITE_DEMO_MODE === 'true') {
  console.warn('WARNING: VITE_DEMO_MODE=true on a production build shows demo credentials on the login page.')
}
console.log(url ? `API base: ${url}` : 'API base: (same origin / dev proxy)')
