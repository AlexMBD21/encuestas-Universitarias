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
    const caller = await admin.auth.getUser(token)
    if (!caller || !caller.data || !caller.data.user) return res.status(401).json({ error: 'Invalid token' })
    const callerUser = caller.data.user
    const callerRole = (callerUser.app_metadata && callerUser.app_metadata.role) || null
    if (callerRole !== 'admin') return res.status(403).json({ error: 'Forbidden: admin role required' })

    const body = req.body || {}
    const legacyKey = body.legacyKey || null
    const email = body.email || null
    const userId = body.userId || null
    const role = body.role || null
    const asignatura = body.asignatura || null
    const password = body.password || null

    if (!legacyKey && !email && !userId) return res.status(400).json({ error: 'Missing target identifier (legacyKey, email or userId)' })

    async function findAuthId() {
      if (userId) return userId
      try {
        if (admin && admin.auth && admin.auth.admin && typeof admin.auth.admin.listUsers === 'function') {
          const listRes = await admin.auth.admin.listUsers()
          const users = listRes && listRes.data ? (listRes.data.users || listRes.data) : null
          if (Array.isArray(users)) {
            const found = users.find(u => {
              try {
                if (userId && u.id === userId) return true
                if (email && String(u.email || '').toLowerCase() === String(email || '').toLowerCase()) return true
                const meta = u.raw_app_meta_data || u.app_metadata || u.raw_user_meta_data || u.user_metadata || {}
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
          // Fallback: try to scan a subset of auth.users and match raw_user_meta_data
          const q = await admin.from('auth.users').select('id, raw_app_meta_data, raw_user_meta_data').limit(500)
          if (!q.error && Array.isArray(q.data)) {
            const found = q.data.find(u => {
              try {
                const r = u.raw_app_meta_data || u.raw_user_meta_data || {}
                return String(r.legacy_key || r.legacyKey || '').toLowerCase() === String(legacyKey).toLowerCase()
              } catch (e) { return false }
            })
            if (found) return found.id
          }
        }
      } catch (e) {}
      return null
    }

    const targetId = await findAuthId()
    if (!targetId) return res.status(404).json({ error: 'User not found' })

    const payload = {}
    if (role || asignatura) {
      payload.app_metadata = {}
      if (role) payload.app_metadata.role = String(role)
      if (asignatura) payload.app_metadata.asignatura = String(asignatura)
    }
    if (password) payload.password = String(password)
    if (Object.keys(payload).length === 0) return res.status(400).json({ error: 'Nothing to update' })

    try {
      if (admin && admin.auth && admin.auth.admin && typeof admin.auth.admin.updateUserById === 'function') {
        const r = await admin.auth.admin.updateUserById(targetId, payload)
        if (r && r.error) return res.status(500).json({ error: r.error.message || r.error })
      } else {
        // Fallback: update raw_app_meta_data for role changes
        if (payload.app_metadata) {
          const q = await admin.from('auth.users').select('raw_app_meta_data').eq('id', targetId).limit(1).maybeSingle()
          const existing = q && q.data ? q.data.raw_app_meta_data || {} : {}
          const merged = Object.assign({}, existing, payload.app_metadata)
          const upd = await admin.from('auth.users').update({ raw_app_meta_data: JSON.stringify(merged) }).eq('id', targetId)
          if (upd.error) return res.status(500).json({ error: upd.error.message || upd.error })
        }
        // password fallback not supported in this path
      }
    } catch (err) {
      return res.status(500).json({ error: err && err.message ? err.message : String(err) })
    }

    try {
      if (role || asignatura) {
        const upds = {}
        if (role) upds.role = String(role)
        if (asignatura) upds.asignatura = String(asignatura)
        
        if (legacyKey) await admin.from('app_users').update(upds).eq('legacy_key', legacyKey)
        else if (email) await admin.from('app_users').update(upds).eq('email', email)
      }
    } catch (e) {}

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('update_user error', err)
    return res.status(500).json({ error: err && err.message ? err.message : 'server error' })
  }
}
