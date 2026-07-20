import type { User } from '@/features/users/types'
import { ROLE } from '@/lib/roles'

type PostLoginUser = Pick<User, 'role'>
type PostLoginAccessRequirement = 'dashboard' | 'user' | 'agent' | 'admin' | 'root'

const ROOT_PREFIXES = ['/system-settings', '/system-info'] as const
const ADMIN_PREFIXES = [
  '/agent-admin',
  '/channels',
  '/redemption-codes',
  '/users',
  '/subscriptions',
  '/models',
] as const
const AUTH_OR_ERROR_PREFIXES = ['/403', '/sign-in', '/sign-up', '/otp'] as const

function matchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`)
}

function hasControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint < 32 || codePoint === 127
  })
}

export function normalizePostLoginPath(
  value: string | undefined
): string | null {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    hasControlCharacter(value)
  ) {
    return null
  }

  try {
    const parsed = new URL(value, 'http://new-api.local')
    if (parsed.origin !== 'http://new-api.local') return null
    if (
      AUTH_OR_ERROR_PREFIXES.some((prefix) =>
        matchesPrefix(parsed.pathname, prefix)
      )
    ) {
      return null
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return null
  }
}

export function getPostLoginAccessRequirement(
  path: string
): PostLoginAccessRequirement {
  if (ROOT_PREFIXES.some((prefix) => matchesPrefix(path, prefix))) {
    return 'root'
  }
  if (ADMIN_PREFIXES.some((prefix) => matchesPrefix(path, prefix))) {
    return 'admin'
  }
  if (matchesPrefix(path, '/agent')) return 'agent'
  if (path === '/dashboard') return 'dashboard'
  return 'user'
}

export async function resolvePostLoginTarget(
  redirectTo: string | undefined,
  user: PostLoginUser | undefined,
  probeAgentAccess: () => Promise<boolean>
): Promise<string> {
  const path = normalizePostLoginPath(redirectTo)
  if (!path || !user) return '/dashboard'

  const requirement = getPostLoginAccessRequirement(
    new URL(path, 'http://new-api.local').pathname
  )

  if (requirement === 'root' && user.role !== ROLE.SUPER_ADMIN) {
    return '/dashboard'
  }
  if (requirement === 'admin' && user.role < ROLE.ADMIN) {
    return '/dashboard'
  }
  if (requirement === 'agent') {
    try {
      return (await probeAgentAccess()) ? path : '/dashboard'
    } catch {
      return '/dashboard'
    }
  }
  return path
}
