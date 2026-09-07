type RuntimeConfig = {
  cognitoAuthUrl?: string
  cognitoClientId?: string
}

type TokenResponse = {
  access_token: string
  expires_in: number
  id_token?: string
}

export type AdminSession = {
  accessToken: string
  expiresAt: number
  idToken?: string
}

const sessionKey = 'truecraft-admin-session'
const pkceKey = 'truecraft-admin-pkce'
const stateKey = 'truecraft-admin-state'

function getRuntimeConfig(): RuntimeConfig {
  return window.__TRUECRAFT_CONFIG__ ?? {}
}

function getRedirectUri() {
  return `${window.location.origin}/admin`
}

function encodeBase64Url(value: ArrayBuffer | Uint8Array) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value)
  let text = ''
  bytes.forEach((byte) => {
    text += String.fromCharCode(byte)
  })
  return window.btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomString(byteLength = 32) {
  const bytes = new Uint8Array(byteLength)
  window.crypto.getRandomValues(bytes)
  return encodeBase64Url(bytes)
}

async function codeChallenge(verifier: string) {
  const encoded = new TextEncoder().encode(verifier)
  const digest = await window.crypto.subtle.digest('SHA-256', encoded)
  return encodeBase64Url(digest)
}

function requireConfig() {
  const config = getRuntimeConfig()
  if (!config.cognitoAuthUrl || !config.cognitoClientId) {
    throw new Error('Admin login is not configured for this environment.')
  }
  return {
    authUrl: config.cognitoAuthUrl.replace(/\/$/, ''),
    clientId: config.cognitoClientId,
  }
}

export function getStoredAdminSession(): AdminSession | undefined {
  try {
    const session = JSON.parse(window.sessionStorage.getItem(sessionKey) ?? '') as AdminSession
    if (!session.accessToken || session.expiresAt <= Date.now() + 30_000) return undefined
    return session
  } catch {
    return undefined
  }
}

export function clearAdminSession() {
  window.sessionStorage.removeItem(sessionKey)
  window.sessionStorage.removeItem(pkceKey)
  window.sessionStorage.removeItem(stateKey)
}

export function adminAuthHeader(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` }
}

export async function createAdminLoginUrl() {
  const { authUrl, clientId } = requireConfig()
  const verifier = randomString(48)
  const state = randomString(24)
  window.sessionStorage.setItem(pkceKey, verifier)
  window.sessionStorage.setItem(stateKey, state)

  const params = new URLSearchParams({
    client_id: clientId,
    code_challenge: await codeChallenge(verifier),
    code_challenge_method: 'S256',
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: 'openid email profile',
    state,
  })

  return `${authUrl}/oauth2/authorize?${params}`
}

export async function startAdminLogin() {
  window.location.assign(await createAdminLoginUrl())
}

export async function completeAdminLoginFromCallback() {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  if (!code) return getStoredAdminSession()

  const returnedState = params.get('state')
  const expectedState = window.sessionStorage.getItem(stateKey)
  const verifier = window.sessionStorage.getItem(pkceKey)
  if (!returnedState || returnedState !== expectedState || !verifier) {
    clearAdminSession()
    throw new Error('Admin login could not be verified.')
  }

  const { authUrl, clientId } = requireConfig()
  const response = await fetch(`${authUrl}/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      code,
      code_verifier: verifier,
      grant_type: 'authorization_code',
      redirect_uri: getRedirectUri(),
    }),
  })

  if (!response.ok) {
    clearAdminSession()
    throw new Error('Admin login failed.')
  }

  const payload = (await response.json()) as TokenResponse
  const session = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + payload.expires_in * 1000,
    idToken: payload.id_token,
  }
  window.sessionStorage.setItem(sessionKey, JSON.stringify(session))
  window.sessionStorage.removeItem(pkceKey)
  window.sessionStorage.removeItem(stateKey)
  window.history.replaceState({}, document.title, getRedirectUri())
  return session
}

export function createAdminLogoutUrl() {
  const config = getRuntimeConfig()
  if (!config.cognitoAuthUrl || !config.cognitoClientId) return undefined

  const params = new URLSearchParams({
    client_id: config.cognitoClientId,
    logout_uri: getRedirectUri(),
  })
  return `${config.cognitoAuthUrl.replace(/\/$/, '')}/logout?${params}`
}

export function logoutAdmin(assign: (url: string) => void = window.location.assign.bind(window.location)) {
  clearAdminSession()
  const logoutUrl = createAdminLogoutUrl()
  if (logoutUrl) assign(logoutUrl)
}
