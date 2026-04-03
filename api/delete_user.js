const { createClient } = require('@supabase/supabase-js')

module.exports = async function (req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST')
      return res.status(405).json({ error: 'Method Not Allowed' })
    }

    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return res.status(500).json({ error: 'Server misconfigured (missing SUPABASE_SERVICE_ROLE_KEY)' })

    const authHeader = req.headers.authorization || req.headers.Authorization || ''
    const token = authHeader && authHeader.split && authHeader.split(' ')[1] ? authHeader.split(' ')[1] : null
    if (!token) return res.status(401).json({ error: 'Missing Authorization token' })

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // Validate caller is admin
    try {
      const caller = await admin.auth.getUser(token)
      if (!caller || !caller.data || !caller.data.user) return res.status(401).json({ error: 'Invalid token' })
      const callerUser = caller.data.user
      const callerRole = (callerUser.app_metadata && callerUser.app_metadata.role) || null
      if (callerRole !== 'admin') return res.status(403).json({ error: 'Forbidden: admin role required' })
    } catch (e) {
      console.error('caller validation failed', e)
      return res.status(401).json({ error: 'Invalid token' })
    }

    const body = req.body || {}
    const legacyKey = body.legacyKey || body.id || body.userId || null
    const email = body.email || null
    const userIdInput = body.userId || null

    async function findAuthId() {
      if (userIdInput) return userIdInput
      try {
        if (admin && admin.auth && admin.auth.admin && typeof admin.auth.admin.listUsers === 'function') {
          const listRes = await admin.auth.admin.listUsers()
          const users = listRes && listRes.data ? (listRes.data.users || listRes.data) : null
          if (Array.isArray(users)) {
            const found = users.find(u => {
              try {
                if (userIdInput && u.id === userIdInput) return true
                if (email && String(u.email || '').toLowerCase() === String(email || '').toLowerCase()) return true
                const meta = u.raw_user_meta_data || u.user_metadata || {}
                if (legacyKey && (String(meta.legacy_key || meta.legacyKey || '').toLowerCase() === String(legacyKey).toLowerCase())) return true
              } catch (e) {}
              return false
            })
            if (found) return found.id
          }
        }
      } catch (e) {}

      try {
        if (email) {
          const q = await admin.from('auth.users').select('id').eq('email', email).limit(1).maybeSingle()
          if (!q.error && q.data) return q.data.id
        }
        if (legacyKey) {
          const a = await admin.from('app_users').select('email').eq('legacy_key', legacyKey).limit(1).maybeSingle()
          if (!a.error && a.data && a.data.email) {
            const q = await admin.from('auth.users').select('id').eq('email', a.data.email).limit(1).maybeSingle()
            if (!q.error && q.data) return q.data.id
          }
          // Fallback: scan a subset of auth.users and match raw_user_meta_data
          const q2 = await admin.from('auth.users').select('id, raw_user_meta_data').limit(500)
          if (!q2.error && Array.isArray(q2.data)) {
            const found = q2.data.find(u => {
              try {
                const r = u.raw_user_meta_data || {}
                return String(r.legacy_key || r.legacyKey || '').toLowerCase() === String(legacyKey).toLowerCase()
              } catch (e) { return false }
            })
            if (found) return found.id
          }
        }
      } catch (e) {}
      return null
    }

    const authUserId = await findAuthId()
    console.log('[api/delete_user] found authUserId ->', authUserId)
    const result = { authDeleted: false, appDeleted: false, authUserIdFound: !!authUserId }

    if (authUserId) {
      try {
        if (admin && admin.auth && admin.auth.admin && typeof admin.auth.admin.deleteUser === 'function') {
          const d = await admin.auth.admin.deleteUser(authUserId)
          if (!d || d.error) {
            // fallback to raw delete
            try {
              const q = await admin.from('auth.users').delete().eq('id', authUserId)
              if (!q.error) result.authDeleted = true
            } catch (e) {}
          } else {
            result.authDeleted = true
          }
        } else {
          const q = await admin.from('auth.users').delete().eq('id', authUserId)
          if (!q.error) result.authDeleted = true
        }
      } catch (e) {
        console.error('auth delete error', e)
      }
    }

    try {
      if (legacyKey) {
        const up = await admin.from('app_users').delete().eq('legacy_key', legacyKey)
        if (!up.error) result.appDeleted = true
      } else if (email) {
        const up = await admin.from('app_users').delete().eq('email', email)
        if (!up.error) result.appDeleted = true
      } else if (userIdInput) {
        const up = await admin.from('app_users').delete().eq('legacy_key', userIdInput)
        if (!up.error) result.appDeleted = true
      }
    } catch (e) {}

    return res.status(200).json({ success: true, result })
  } catch (err) {
    console.error('delete_user error', err)
    return res.status(500).json({ error: err && err.message ? err.message : 'server error' })
  }
}
