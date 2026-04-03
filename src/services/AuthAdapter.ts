// AuthAdapter: pequeño servicio que usa window.Utils si está disponible,
// o cae a localStorage. Esto permite integrarse con el código existente
// durante la migración.

import supabaseClient from './supabaseClient'

const KEY = 'edusurvey_user'
let cachedUser: any = null

const saveUser = (user: any) => {
  try {
    if ((window as any).Utils && (window as any).Utils.saveUserData) {
      (window as any).Utils.saveUserData(user)
    } else {
      // keep an in-memory cached user and persist to localStorage so
      // the session survives closing and reopening the browser
      cachedUser = user
      try { localStorage.setItem(KEY, JSON.stringify(user)) } catch (e) {}
    }
  } catch (_) {}
  try { window.dispatchEvent(new CustomEvent('auth:changed', { detail: { user } })) } catch (e) {}
}

const getUser = () => {
  try {
    // Prefer window Utils if provided (legacy integration)
    if ((window as any).Utils && (window as any).Utils.getUserData) {
      return (window as any).Utils.getUserData()
    }
  } catch (_) {}

  // Prefer Supabase current user mapping if available
  try {
    if (supabaseClient && (supabaseClient as any).isEnabled && (supabaseClient as any).isEnabled()) {
      try {
        const userObj = (supabaseClient as any).getAuthCurrentUser ? (supabaseClient as any).getAuthCurrentUser() : null
        if (userObj) {
          const merged = { id: (userObj && (userObj.id || userObj.uid)) || null, email: userObj.email || null, ...(cachedUser || {}) }
          return merged
        }
      } catch (e) {}
    }
  } catch (e) {}

  // If no firebase user and we have a localStorage entry, restore it
  try {
    if (!cachedUser) {
      const raw = localStorage.getItem(KEY)
      if (raw) {
        try { cachedUser = JSON.parse(raw) } catch (e) {}
      }
    }
  } catch (e) {}

  return cachedUser
}

const logout = async () => {
  try {
    if (supabaseClient && (supabaseClient as any).isEnabled && (supabaseClient as any).isEnabled()) {
      try { await supabaseClient.firebaseSignOut() } catch (e) { console.warn('supabase signOut failed', e) }
    }
    if ((window as any).Utils && (window as any).Utils.logout) {
      (window as any).Utils.logout()
      return
    }
  } catch (_) {}
  try { cachedUser = null } catch (e) {}
  try { localStorage.removeItem(KEY) } catch (e) {}
  try { window.dispatchEvent(new CustomEvent('auth:changed', { detail: { user: null } })) } catch (e) {}
}

// Simulated async login helper. When real backend is ready, replace
// the implementation to call your login endpoint and return the user.
const login = async (email: string, password: string, role: string) => {
  // If Firebase is initialized, use it. Otherwise fallback to the legacy simulated login.
  // If Supabase is enabled, use it. Otherwise fallback to Firebase, then legacy.
  if (supabaseClient && (supabaseClient as any).isEnabled && (supabaseClient as any).isEnabled()) {
    try {
      const user = await supabaseClient.firebaseSignIn(email, password)
      const appUser: any = { id: (user && (user.id as any)) || null, email: user.email || null, role: role === 'profesor' ? 'profesor' : 'estudiante' }
      saveUser(appUser)
      return appUser
    } catch (e) {
      // Map common auth errors to friendly messages when possible
      try {
        const code = (e && (e as any).code) ? String((e as any).code) : ''
        const msg = (e && (e as any).message) ? String((e as any).message) : ''
        let friendly = 'Error en la autenticación'
        if (code) {
          const c = code.toLowerCase()
          if (c.indexOf('invalid-password') >= 0 || c.indexOf('invalid-credential') >= 0 || c.indexOf('user-not-found') >= 0 || c.indexOf('invalid-login') >= 0) {
            friendly = 'Correo electrónico o contraseña incorrectos'
          } else if (c.indexOf('invalid-email') >= 0) {
            friendly = 'Correo electrónico inválido'
          } else if (c.indexOf('too-many-requests') >= 0) {
            friendly = 'Demasiados intentos. Intenta nuevamente más tarde.'
          } else if (c.indexOf('network-request-failed') >= 0) {
            friendly = 'Error de red. Revisa tu conexión e intenta de nuevo.'
          } else {
            friendly = msg || friendly
          }
        } else {
          const lowered = msg.toLowerCase()
          if (lowered.indexOf('wrong-password') >= 0 || lowered.indexOf('invalid-credential') >= 0 || lowered.indexOf('user-not-found') >= 0) {
            friendly = 'Correo electrónico o contraseña incorrectos'
          } else if (lowered.indexOf('invalid-email') >= 0) {
            friendly = 'Correo electrónico inválido'
          } else if (lowered.indexOf('permission-denied') >= 0) {
            friendly = 'Permiso denegado'
          } else {
            friendly = msg || friendly
          }
        }
        throw new Error(friendly)
      } catch (mapErr) {
        throw new Error((e && (e as any).message) || 'Authentication failed')
      }
    }
  }

  // Legacy fallback (local validation)
  return new Promise<any>((resolve, reject) => {
    setTimeout(() => {
      const errors: string[] = []
      if (!email || !email.includes('@')) errors.push('Correo inválido')
      if (!password || password.length < 4) errors.push('Contraseña demasiado corta')

      if (errors.length) return reject(new Error(errors[0]))

      const user: any = { role: role === 'profesor' ? 'profesor' : 'estudiante', email }
      try {
        if ((window as any).Utils && (window as any).Utils.saveUserData) {
          (window as any).Utils.saveUserData(user)
        } else {
          // store in-memory only for legacy flow
          saveUser(user)
        }
      } catch (_) {}
      resolve(user)
    }, 600)
  })
}

export default { saveUser, getUser, logout, login }
