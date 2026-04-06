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

    // parse body
    const body = req.body || {}
    const email = body.email && String(body.email).trim()
    const password = body.password && String(body.password)
    const role = body.role && String(body.role) || 'profesor'
    const asignatura = body.asignatura ? String(body.asignatura) : ''
    if (!email || !email.includes('@') || !password) return res.status(400).json({ error: 'Invalid payload: email and password required' })

    // Try to create Auth user via admin API
    try {
      const { data, error } = await admin.auth.admin.createUser({
        email: String(email),
        password: String(password),
        email_confirm: true,
        app_metadata: { role, asignatura }
      })
      if (error) {
        // if user exists, try to find by email and set metadata
        const q = await admin.from('auth.users').select('id').eq('email', email).limit(1).maybeSingle()
        if (q.error || !q.data) {
          return res.status(500).json({ error: error.message || error })
        }
        const uid = q.data.id
        try { await admin.auth.admin.updateUserById(uid, { app_metadata: { role, asignatura } }) } catch (e) { /* ignore */ }
      } else {
        const newId = (data && data.user && data.user.id) || (data && data.id) || null
        if (newId) {
          try { await admin.auth.admin.updateUserById(newId, { app_metadata: { role, asignatura } }) } catch (e) { /* ignore */ }
        }
      }
    } catch (e) {
      return res.status(500).json({ error: (e && e.message) ? e.message : 'create user failed' })
    }

    // Note: compatibility rows in `app_users` are populated by a DB trigger
    // (see sql/create_auth_triggers.sql -> handle_auth_user_upsert). No
    // manual upsert is required here to avoid duplication and race conditions.

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('create_user error', err)
    return res.status(500).json({ error: err && err.message ? err.message : 'server error' })
  }
}
