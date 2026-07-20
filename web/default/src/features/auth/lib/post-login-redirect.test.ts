import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { ROLE } from '@/lib/roles'

import { resolvePostLoginTarget } from './post-login-redirect'

describe('post-login redirect policy', () => {
  test('preserves only targets allowed for the new account', async () => {
    assert.equal(
      await resolvePostLoginTarget(
        '/agent-admin',
        { role: ROLE.ADMIN },
        async () => false
      ),
      '/agent-admin'
    )
    assert.equal(
      await resolvePostLoginTarget(
        '/agent-admin',
        { role: ROLE.USER },
        async () => false
      ),
      '/dashboard'
    )
    assert.equal(
      await resolvePostLoginTarget(
        '/agent',
        { role: ROLE.USER },
        async () => true
      ),
      '/agent'
    )
    assert.equal(
      await resolvePostLoginTarget(
        '/agent',
        { role: ROLE.USER },
        async () => false
      ),
      '/dashboard'
    )
    assert.equal(
      await resolvePostLoginTarget(
        '/wallet?tab=topup',
        { role: ROLE.USER },
        async () => false
      ),
      '/wallet?tab=topup'
    )
  })

  test('requires Root for system routes and preserves query fragments', async () => {
    assert.equal(
      await resolvePostLoginTarget(
        '/system-settings/site?tab=branding#logo',
        { role: ROLE.SUPER_ADMIN },
        async () => false
      ),
      '/system-settings/site?tab=branding#logo'
    )
    assert.equal(
      await resolvePostLoginTarget(
        '/system-settings/site',
        { role: ROLE.ADMIN },
        async () => false
      ),
      '/dashboard'
    )
  })

  test('rejects external, malformed, and auth/error targets', async () => {
    for (const target of [
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      '/agent\\admin',
      '/403',
      '/sign-in',
      '/otp',
    ]) {
      assert.equal(
        await resolvePostLoginTarget(
          target,
          { role: ROLE.USER },
          async () => false
        ),
        '/dashboard',
        target
      )
    }
  })

  test('uses path boundaries for protected routes', async () => {
    assert.equal(
      await resolvePostLoginTarget(
        '/users-example',
        { role: ROLE.USER },
        async () => false
      ),
      '/users-example'
    )
  })

  test('probes agent access only for an agent target', async () => {
    let calls = 0
    const probe = async () => {
      calls += 1
      return true
    }

    await resolvePostLoginTarget('/wallet', { role: ROLE.USER }, probe)
    await resolvePostLoginTarget('/agent-admin', { role: ROLE.ADMIN }, probe)
    assert.equal(calls, 0)

    await resolvePostLoginTarget('/agent', { role: ROLE.USER }, probe)
    assert.equal(calls, 1)
  })

  test('falls back when the agent access probe fails', async () => {
    assert.equal(
      await resolvePostLoginTarget('/agent', { role: ROLE.USER }, async () => {
        throw new Error('temporary failure')
      }),
      '/dashboard'
    )
  })
})
