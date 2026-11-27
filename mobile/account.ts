export interface AccountSession {
  refresh_token: string
  access_token: string
  user: { id: string; email: string }
}

export class AccountError extends Error {
  readonly status: number

  constructor(status: number) {
    super('Account request failed')
    this.status = status
  }
}

export function accountClient(url?: string, key?: string, request = fetch) {
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(url ?? '') || !key?.startsWith('sb_publishable_')) return
  const base = url!.replace(/\/$/, '') + '/auth/v1/'
  async function post(path: string, body: object, access?: string) {
    const response = await request(base + path, {
      method: 'POST',
      headers: { apikey: key!, 'Content-Type': 'application/json', ...(access ? { Authorization: 'Bearer ' + access } : {}) },
      body: JSON.stringify(body)
    })
    if (!response.ok) throw new AccountError(response.status)
    return response
  }
  async function session(path: string, body: object): Promise<AccountSession> {
    const data = await (await post(path, body)).json()
    if (typeof data?.refresh_token !== 'string' || typeof data.access_token !== 'string' ||
        typeof data.user?.id !== 'string' || typeof data.user.email !== 'string') throw new Error('Invalid account response')
    return data
  }
  return {
    async sendCode(email: string) { await post('otp', { email, create_user: true }) },
    verify: (email: string, token: string) => session('verify', { email, token, type: 'email' }),
    refresh: (refresh_token: string) => session('token?grant_type=refresh_token', { refresh_token }),
    async logout(access: string) { await post('logout?scope=local', {}, access) }
  }
}
