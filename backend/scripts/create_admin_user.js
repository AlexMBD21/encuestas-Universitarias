const { createClient } = require('@supabase/supabase-js')

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
      const { data, error } = await supabase.auth.admin.updateUserById(userId, { app_metadata: { role } })
      if (error) throw error
      return true
    }
  } catch (e) {
    // ignore and fallback
  }

  // Fallback: try to update raw_app_meta_data in auth.users
  try {
    const q = await supabase.from('auth.users').select('raw_app_meta_data').eq('id', userId).limit(1).maybeSingle()
    if (!q.error && q.data) {
      const existing = q.data.raw_app_meta_data || {}
      const merged = Object.assign({}, existing, { role })
      const upd = await supabase.from('auth.users').update({ raw_app_meta_data: JSON.stringify(merged) }).eq('id', userId)
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
    const q = await supabase.from('auth.users').select('id, raw_user_meta_data').eq('email', email).limit(1).maybeSingle()
    if (q.error) return false
    if (q.data && q.data.id) {
      return await trySetMetadataByUserId(supabase, q.data.id, role)
    }
  } catch (e) {}
  return false
}

async function main() {
  const args = parseArgs()
  const email = args.email || process.env.ADMIN_EMAIL
  const password = args.password || process.env.ADMIN_PASSWORD
  const role = args.role || 'admin'

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en las variables de entorno.')
    console.error('En PowerShell: $env:SUPABASE_SERVICE_ROLE_KEY = "sb_secret_..."; luego ejecuta el script y elimina la variable.')
    process.exit(2)
  }

  if (!email || !password) {
    console.error('Uso: node backend/scripts/create_admin_user.js --email admin@example.com --password "P@ssw0rd!"')
    process.exit(3)
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  try {
    console.log('Creando usuario en Auth (admin API)...')
    const { data, error } = await supabase.auth.admin.createUser({
      email: String(email),
      password: String(password),
      email_confirm: true,
      app_metadata: { role }
    })

    let newUserId = null
    if (error) {
      console.error('Aviso: error creando usuario en Auth:', error.message || error)
      // intentaremos localizar usuario existente por email
    } else {
      // data may contain user
      if (data && data.user && data.user.id) newUserId = data.user.id
      else if (data && data.id) newUserId = data.id
      console.log('Usuario Auth creado (o recibido):', newUserId || '[ok]')
    }

    // If we have a user id, try to ensure the role is set via admin API (or fallback to direct table update)
    if (newUserId) {
      const ok = await trySetMetadataByUserId(supabase, newUserId, role)
      if (ok) console.log('Metadata de role establecida en el usuario Auth.')
      else console.warn('No se pudo setear metadata vía admin API; intenta con SQL Editor si es necesario.')
    } else {
      // user may already exist: try to set metadata by email
      const ok2 = await trySetMetadataByEmail(supabase, String(email), role)
      if (ok2) console.log('Metadata de role establecida en el usuario Auth (buscando por email).')
      else console.warn('No se pudo localizar al usuario en auth.users para setear metadata.')
    }

    // Upsert into app_users table for compatibility with the app
    try {
      const legacy_key = `admin_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`
      const payload = { legacy_key, email: String(email), role: String(role), created_at: new Date().toISOString() }
      const up = await supabase.from('app_users').upsert([payload], { onConflict: 'legacy_key' })
      if (up.error) {
        console.error('Warning: no se pudo insertar fila en app_users:', up.error.message || up.error)
      } else {
        console.log('Fila app_users creada/actualizada.')
      }
    } catch (e) {
      console.error('Error insertando en app_users:', e && e.message ? e.message : e)
    }

    console.log('\nHecho. Puedes iniciar sesión con el usuario admin creado.')
    console.log('Recuerda borrar la variable de entorno del Service Role cuando termines.')
  } catch (err) {
    console.error('Error inesperado:', err && err.message ? err.message : err)
    process.exit(4)
  }
}

main()
