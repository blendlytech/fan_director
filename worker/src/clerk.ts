import { ApiError } from './http'
import type { ClerkBackend, ClerkSession, ClerkUser } from './types'

const API = 'https://api.clerk.com/v1'
const USER_ID = /^user_[A-Za-z0-9]{1,64}$/
const SESSION_ID = /^sess_[A-Za-z0-9]{1,64}$/

interface RawUser {
  id: string
  primary_email_address_id: string | null
  email_addresses: { id: string; email_address: string; verification: { status: string } | null }[]
  totp_enabled: boolean
  backup_code_enabled: boolean
  banned: boolean
  locked: boolean
  created_at: number
}

interface RawSession {
  id: string
  user_id: string
  status: string
  created_at: number
}

function toSession(raw: RawSession): ClerkSession {
  return { id: raw.id, userId: raw.user_id, status: raw.status, createdAt: raw.created_at }
}

/** Clerk Backend API over fetch. Any failure surfaces as a 503, never as data. */
export function httpClerk(secretKey: string): ClerkBackend {
  async function get<T>(path: string): Promise<T | null> {
    let res: Response
    try {
      res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${secretKey}` } })
    } catch {
      throw new ApiError(503, 'auth_unavailable')
    }
    if (res.status === 404) return null
    if (!res.ok) throw new ApiError(503, 'auth_unavailable')
    return (await res.json()) as T
  }

  return {
    async getUser(userId) {
      if (!USER_ID.test(userId)) return null
      const raw = await get<RawUser>(`/users/${userId}`)
      if (!raw) return null
      const user: ClerkUser = {
        id: raw.id,
        primaryEmailAddressId: raw.primary_email_address_id,
        emailAddresses: raw.email_addresses.map((e) => ({
          id: e.id,
          emailAddress: e.email_address,
          verified: e.verification?.status === 'verified',
        })),
        totpEnabled: raw.totp_enabled,
        backupCodeEnabled: raw.backup_code_enabled,
        banned: raw.banned,
        locked: raw.locked,
        createdAt: raw.created_at,
      }
      return user
    },
    async getSession(sessionId) {
      if (!SESSION_ID.test(sessionId)) return null
      const raw = await get<RawSession>(`/sessions/${sessionId}`)
      return raw ? toSession(raw) : null
    },
    async listLiveSessions(userId) {
      if (!USER_ID.test(userId)) return []
      const raw = await get<RawSession[] | { data: RawSession[] }>(`/sessions?user_id=${userId}&limit=20`)
      const list = raw === null ? [] : Array.isArray(raw) ? raw : raw.data
      return list.map(toSession).filter((s) => s.status === 'active' || s.status === 'pending')
    },
  }
}

/** The user's primary email, only if Clerk reports it verified. */
export function verifiedPrimaryEmail(user: ClerkUser): string | null {
  const primary = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
  return primary && primary.verified ? primary.emailAddress : null
}
