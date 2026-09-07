import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  adminAuthHeader,
  clearAdminSession,
  completeAdminLoginFromCallback,
  createAdminLoginUrl,
  createAdminLogoutUrl,
  getStoredAdminSession,
  logoutAdmin,
} from './cognito'

const originalCrypto = window.crypto

function setRuntimeConfig() {
  Object.defineProperty(window, '__TRUECRAFT_CONFIG__', {
    configurable: true,
    value: {
      cognitoAuthUrl: 'https://truecraft-admin.auth.eu-west-2.amazoncognito.com',
      cognitoClientId: 'client-123',
    },
  })
}

afterEach(() => {
  window.history.replaceState({}, '', '/')
  window.sessionStorage.clear()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  Object.defineProperty(window, 'crypto', {
    configurable: true,
    value: originalCrypto,
  })
  Reflect.deleteProperty(window, '__TRUECRAFT_CONFIG__')
})

describe('Cognito admin auth helpers', () => {
  it('reads valid stored sessions and ignores expired or malformed sessions', () => {
    window.sessionStorage.setItem(
      'truecraft-admin-session',
      JSON.stringify({
        accessToken: 'admin-token',
        expiresAt: Date.now() + 60_000,
      }),
    )

    expect(getStoredAdminSession()?.accessToken).toBe('admin-token')

    window.sessionStorage.setItem(
      'truecraft-admin-session',
      JSON.stringify({
        accessToken: 'admin-token',
        expiresAt: Date.now() - 1,
      }),
    )
    expect(getStoredAdminSession()).toBeUndefined()

    window.sessionStorage.setItem('truecraft-admin-session', 'not-json')
    expect(getStoredAdminSession()).toBeUndefined()
  })

  it('builds bearer authorization headers and clears auth storage', () => {
    window.sessionStorage.setItem('truecraft-admin-session', 'session')
    window.sessionStorage.setItem('truecraft-admin-pkce', 'verifier')
    window.sessionStorage.setItem('truecraft-admin-state', 'state')

    expect(adminAuthHeader('admin-token')).toEqual({ Authorization: 'Bearer admin-token' })

    clearAdminSession()

    expect(window.sessionStorage.getItem('truecraft-admin-session')).toBeNull()
    expect(window.sessionStorage.getItem('truecraft-admin-pkce')).toBeNull()
    expect(window.sessionStorage.getItem('truecraft-admin-state')).toBeNull()
  })

  it('returns no logout URL when Cognito runtime config is missing', () => {
    window.sessionStorage.setItem('truecraft-admin-session', 'session')

    expect(createAdminLogoutUrl()).toBeUndefined()

    logoutAdmin()
    expect(window.sessionStorage.getItem('truecraft-admin-session')).toBeNull()
  })

  it('redirects to Cognito logout when runtime config exists', () => {
    setRuntimeConfig()
    const assign = vi.fn()

    logoutAdmin(assign)

    expect(assign).toHaveBeenCalledWith(expect.stringContaining('/logout?'))
  })

  it('creates Cognito login and logout URLs without storing secrets in the browser', async () => {
    setRuntimeConfig()
    Object.defineProperty(window, 'crypto', {
      configurable: true,
      value: {
        getRandomValues: (bytes: Uint8Array) => bytes.fill(1),
        subtle: {
          digest: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]).buffer),
        },
      },
    })

    const loginUrl = await createAdminLoginUrl()
    const logoutUrl = createAdminLogoutUrl()

    expect(loginUrl).toContain('https://truecraft-admin.auth.eu-west-2.amazoncognito.com/oauth2/authorize?')
    expect(loginUrl).toContain('response_type=code')
    expect(loginUrl).toContain('code_challenge_method=S256')
    expect(loginUrl).toContain('client_id=client-123')
    expect(loginUrl).not.toContain('client_secret')
    expect(window.sessionStorage.getItem('truecraft-admin-pkce')).toBeTruthy()
    expect(window.sessionStorage.getItem('truecraft-admin-state')).toBeTruthy()
    expect(logoutUrl).toContain('https://truecraft-admin.auth.eu-west-2.amazoncognito.com/logout?')
    expect(logoutUrl).toContain('client_id=client-123')
  })

  it('exchanges a Cognito callback code for a stored session', async () => {
    setRuntimeConfig()
    window.history.replaceState({}, '', '/admin?code=auth-code&state=expected-state')
    window.sessionStorage.setItem('truecraft-admin-pkce', 'code-verifier')
    window.sessionStorage.setItem('truecraft-admin-state', 'expected-state')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'access-token',
        expires_in: 3600,
        id_token: 'id-token',
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const session = await completeAdminLoginFromCallback()

    expect(session?.accessToken).toBe('access-token')
    expect(window.sessionStorage.getItem('truecraft-admin-session')).toContain('access-token')
    expect(window.location.search).toBe('')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://truecraft-admin.auth.eu-west-2.amazoncognito.com/oauth2/token',
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
      }),
    )
  })

  it('rejects callback state mismatches before token exchange', async () => {
    setRuntimeConfig()
    window.history.replaceState({}, '', '/admin?code=auth-code&state=bad-state')
    window.sessionStorage.setItem('truecraft-admin-pkce', 'code-verifier')
    window.sessionStorage.setItem('truecraft-admin-state', 'expected-state')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(completeAdminLoginFromCallback()).rejects.toThrow('Admin login could not be verified.')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(window.sessionStorage.getItem('truecraft-admin-pkce')).toBeNull()
  })

  it('clears auth storage when Cognito rejects the code exchange', async () => {
    setRuntimeConfig()
    window.history.replaceState({}, '', '/admin?code=auth-code&state=expected-state')
    window.sessionStorage.setItem('truecraft-admin-pkce', 'code-verifier')
    window.sessionStorage.setItem('truecraft-admin-state', 'expected-state')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
      }),
    )

    await expect(completeAdminLoginFromCallback()).rejects.toThrow('Admin login failed.')

    expect(window.sessionStorage.getItem('truecraft-admin-pkce')).toBeNull()
    expect(window.sessionStorage.getItem('truecraft-admin-state')).toBeNull()
  })
})
