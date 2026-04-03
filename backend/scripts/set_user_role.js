const { createClient } = require('@supabase/supabase-js')
const path = require('path')
try { require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') }) } catch (e) { /* ignore if dotenv not installed */ }

function parseArgs() {
  const args = process.argv.slice(2)
  const out = {}
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (!a) continue
    if (a.startsWith('--')) {
      const k = a.slice(2)
      const v = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true
      out[k] = v
      if (v !== true) i++
    }
  }
  return out
}

async function trySetMetadataByUserId(supabase, userId, role) {
  try {
    if (supabase && supabase.auth && supabase.auth.admin && typeof supabase.auth.admin.updateUserById === 'function') {
      const { data, error } = await supabase.auth.admin.updateUserById(userId, { user_metadata: { role } })
      if (error) throw error
      return true
    }
  } catch (e) {
    // ignore and fallback
  }

  // Fallback: try to update raw_user_meta_data in auth.users
  try {
    const q = await supabase.from('auth.users').select('raw_user_meta_data').eq('id', userId).limit(1).maybeSingle()
    if (!q.error && q.data) {
      const existing = q.data.raw_user_meta_data || {}
      const merged = Object.assign({}, existing, { role })
      const upd = await supabase.from('auth.users').update({ raw_user_meta_data: JSON.stringify(merged) }).eq('id', userId)
      if (upd.error) throw upd.error
      return true
    }
  } catch (e) {
    // ignore
  }
  return false
}

async function trySetMetadataByEmail(supabase, email, role) {
  try {
    // Try admin.listUsers() first (admin API) to avoid relying on PostgREST access to auth.users
    try {
      if (supabase && supabase.auth && supabase.auth.admin && typeof supabase.auth.admin.listUsers === 'function') {
        const listRes = await supabase.auth.admin.listUsers()
        console.log('debug: admin.listUsers result ->', listRes && listRes.data ? (listRes.data.users || listRes.data) : listRes)
        const users = listRes && listRes.data ? (listRes.data.users || listRes.data) : null
        if (Array.isArray(users)) {
          const found = users.find(u => String(u.email || '').toLowerCase() === String(email || '').toLowerCase())
          if (found && found.id) return await trySetMetadataByUserId(supabase, found.id, role)
        }
      }
    } catch (e) {
      console.log('debug: admin.listUsers failed', e && e.message ? e.message : e)
    }

    const q = await supabase.from('auth.users').select('id, raw_user_meta_data').eq('email', email).limit(1).maybeSingle()
    console.log('debug: auth.users query result ->', JSON.stringify(q && q.data ? { id: q.data.id, raw_user_meta_data: q.data.raw_user_meta_data } : q))
    if (q.error) return false
    if (q.data && q.data.id) {
      return await trySetMetadataByUserId(supabase, q.data.id, role)
    }
  } catch (e) {}
  return false
}

async function main() {
  const args = parseArgs()
  const email = args.email || process.env.ADMIN_EMAIL || 'admin@local.test'
  const role = args.role || 'admin'

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en las variables de entorno.')
    process.exit(2)
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  try {
    console.log(`Buscando usuario ${email} y aplicando role='${role}'...`)
    const ok = await trySetMetadataByEmail(supabase, String(email), String(role))
    if (ok) console.log('Role actualizado correctamente.')
    else console.error('No se pudo actualizar metadata del usuario. Revisa que el email exista o usa el SQL editor.')
  } catch (err) {
    console.error('Error inesperado:', err && err.message ? err.message : err)
    process.exit(3)
  }
}

main()
