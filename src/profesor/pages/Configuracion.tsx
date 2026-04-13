
import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom';
import supabaseClient from '../../services/supabaseClient'
import AuthAdapter from '../../services/AuthAdapter'
import { useAuth } from '../../services/AuthContext'
import { toast } from '../../components/ui/Toast'
import { Modal } from '../../components/ui/Modal';

export default function Configuracion() {
  const navigate = useNavigate();
  const supabaseEnabledNow = (supabaseClient && (supabaseClient as any).isEnabled && (supabaseClient as any).isEnabled())
  const dataClientNow: any = supabaseClient
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [msgType, setMsgType] = useState<'success' | 'error'>('success')

  const user = AuthAdapter.getUser()
  const email = user ? (user.email || '') : ''
  const { user: currentUser } = useAuth()
  const isAdmin = (currentUser && (currentUser as any).role === 'admin') || (user && (user.role === 'admin'))
  const [adminVisible, setAdminVisible] = useState<boolean>(!!isAdmin)

  // users list for admin
  const [usersList, setUsersList] = useState<any[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [userMsg, setUserMsg] = useState<string | null>(null)
  const [userMsgType, setUserMsgType] = useState<'success' | 'error'>('success')
  const [searchQ, setSearchQ] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 5



  // modal state for create/edit/delete
  const [modalOpen, setModalOpen] = useState(false)
  const [modalType, setModalType] = useState<'create' | 'edit' | 'delete' | null>(null)
  const [modalData, setModalData] = useState<any>({ email: '', role: 'profesor', password: '', asignatura: '' })
  const [modalLoading, setModalLoading] = useState(false)
  const [modalShowPassword, setModalShowPassword] = useState(false)
  const [modalMsg, setModalMsg] = useState<string | null>(null)
  const [modalMsgType, setModalMsgType] = useState<'success' | 'error'>('success')
  // confirm password-change modal
  const [confirmPwdOpen, setConfirmPwdOpen] = useState(false)
  /** Reemplaza el viejo showToast: mapea 'kind' al tipo del sistema global */
  const showToast = (msg: string | null, kind: 'create' | 'edit' | 'delete' | 'info' = 'info', _autoHide?: boolean) => {
    if (!msg) return
    const typeMap: Record<string, 'success' | 'error' | 'warning' | 'info'> = {
      create: 'success', edit: 'success', delete: 'warning', info: 'info'
    }
    toast({ message: msg, type: typeMap[kind] ?? 'info' })
  }

  const translateErrorForToast = (msg: string | null) => {
    try {
      if (!msg) return msg
      const m = String(msg || '').toLowerCase()
      if (m.includes('new password should be different') || m.includes('new password must be different')) {
        return 'La nueva contraseña debe ser diferente a la anterior.'
      }
      if (m.includes('must be at least') && m.includes('characters')) {
        return 'La contraseña debe tener la longitud mínima requerida.'
      }
      if (m.includes('invalid') || m.includes('error')) return 'Error al cambiar la contraseña.'
      return String(msg)
    } catch (e) { return msg }
  }

  useEffect(() => {
    const loadUsers = async () => {
      if (!isAdmin) return
      if (!dataClientNow || !(dataClientNow as any).isEnabled || !(dataClientNow as any).isEnabled()) return
      setUsersLoading(true)
      try {
        const u = await (dataClientNow as any).getUsersOnce()
        setUsersList(u || [])

      } catch (e) {
        console.error('load users failed', e)
        setUsersList([])
        setUserMsgType('error')
        setUserMsg('No se pudieron cargar usuarios. Revisa las políticas de Supabase o los permisos de la cuenta.')
      } finally { setUsersLoading(false) }
    }
    loadUsers()
    if (isAdmin) setAdminVisible(true)
  }, [isAdmin])



  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    if (!newPassword || !confirmPassword) {
      setMsgType('error')
      setMessage('Complete las contraseñas')
      return
    }
    if (newPassword !== confirmPassword) {
      setMsgType('error')
      setMessage('La nueva contraseña y la confirmación no coinciden')
      return
    }
    // Show confirmation modal before executing
    setConfirmPwdOpen(true)
  }

  const doChangePassword = async () => {
    setConfirmPwdOpen(false)
    setLoading(true)
    setMessage(null)
    try {
      await (dataClientNow as any).changePassword('', newPassword)
      setMsgType('success')
      setMessage('Contraseña actualizada correctamente')
      try { showToast('Contraseña actualizada correctamente', 'edit', true) } catch (e) {}
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      const em = (err && err.message) ? String(err.message) : 'Error al cambiar contraseña'
      const toastText = translateErrorForToast(em)
      setMsgType('error')
      setMessage(em)
      try { showToast(toastText, 'info', false) } catch (e) {}
    } finally {
      setLoading(false)
    }
  }

  // Admin: create or update user
  const handleSaveUser = async (e?: React.FormEvent) => {
    // legacy form submit (kept for compatibility) - open create modal
    if (e) e.preventDefault()
    openCreateModal()
  }

  const openCreateModal = () => {
    setModalData({ email: '', role: 'profesor', password: '', confirmPassword: '' })
    setModalType('create')
    setModalShowPassword(false)
    setModalMsg(null)
    setModalMsgType('success')
    setModalOpen(true)
  }

  const openEditModal = (u: any) => {
    setModalData({ id: u.id, email: u.email, role: u.role || 'profesor', password: '' })
    setModalType('edit')
    setModalShowPassword(false)
    setModalMsg(null)
    setModalMsgType('success')
    setModalOpen(true)
  }

  const openDeleteModal = (u: any) => {
    setModalData({ id: u.id, email: u.email })
    setModalType('delete')
    setModalMsg(null)
    setModalMsgType('success')
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setModalType(null)
    setModalData({ email: '', role: 'profesor', password: '' })
    setModalLoading(false)
    setModalShowPassword(false)
  }

  const confirmModalSave = async () => {
    if (!isAdmin) return
    setModalLoading(true)
    setModalMsg(null)
    setModalMsgType('success')
    try {
      if (modalType === 'create') {
        if (!modalData.email || !modalData.email.includes('@')) throw new Error('Email inválido')
        const pwd = modalData.password && String(modalData.password).trim()
        if (pwd) {
          const token = await ((dataClientNow as any).getAccessToken ? (dataClientNow as any).getAccessToken() : (supabaseClient as any).getAccessToken())
          if (!token) throw new Error('Debes iniciar sesión como administrador para crear la cuenta Auth')
          const resp = await fetch('/api/create_user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ email: modalData.email, password: pwd, role: modalData.role || 'profesor' })
          })
          if (!resp.ok) {
            let errBody: any = {}
            try { errBody = await resp.json() } catch (e) {}
            try { await (dataClientNow as any).pushUser({ email: modalData.email, role: modalData.role }) } catch (e) {}
            if (resp.status === 404) {
              const msg = 'Endpoint /api/create_user no disponible (404). Se creó solo la metadata en app_users. Para crear la cuenta Auth en local, ejecuta `vercel dev` o usa el script `backend/scripts/create_admin_user.js` con una Service Role key.'
              setModalMsgType('success')
              setModalMsg(msg)
              showToast(msg, 'create', true)
              setTimeout(() => closeModal(), 1200)
            } else {
              const msg = (errBody && errBody.error) ? String(errBody.error) : `Error creando usuario: ${resp.status}`
              setModalMsgType('error')
              setModalMsg(msg)
              showToast(msg, 'create', false)
            }
          } else {
            const msg = 'Usuario Auth creado correctamente.'
            setModalMsgType('success')
            setModalMsg(msg)
            showToast(msg, 'create', true)
            setTimeout(() => closeModal(), 1200)
          }
        } else {
          await (dataClientNow as any).pushUser({ email: modalData.email, role: modalData.role })
          const msg = 'Usuario creado (metadata). Para crear la cuenta Auth, especifique una contraseña o use la función segura del servidor.'
          setModalMsgType('success')
          setModalMsg(msg)
          showToast(msg, 'create', true)
          setTimeout(() => closeModal(), 1200)
        }
      } else if (modalType === 'edit') {
        const updateObj: any = { email: modalData.email, role: modalData.role }
        try {
          const token = await ((dataClientNow as any).getAccessToken ? (dataClientNow as any).getAccessToken() : (supabaseClient as any).getAccessToken())
          if (!token) throw new Error('Debes iniciar sesión como administrador para aplicar cambios')
          const body: any = { legacyKey: modalData.id, email: modalData.email, role: modalData.role }
          if (modalData.password) body.password = modalData.password
          const resp = await fetch('/api/update_user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(body)
          })
          if (!resp.ok) {
            let errBody: any = {}
            try { errBody = await resp.json() } catch (e) {}
            if (resp.status === 404) {
              if (modalData.password) {
                updateObj.passwordResetRequestedAt = new Date().toISOString()
                updateObj.passwordResetRequestedBy = (currentUser && (currentUser as any).email) || 'admin'
              }
              await (dataClientNow as any).setUserById(modalData.id, updateObj)
              const msg = 'Endpoint /api/update_user no disponible. Se registró la metadata localmente.'
              setModalMsgType('success')
              setModalMsg(msg)
              showToast(msg, 'edit', true)
              setTimeout(() => closeModal(), 1200)
            } else {
              const msg = (errBody && errBody.error) ? String(errBody.error) : `Error actualizando usuario (${resp.status})`
              setModalMsgType('error')
              setModalMsg(msg)
              showToast(msg, 'edit', false)
            }
          } else {
            const msg = modalData.password ? 'Usuario actualizado correctamente.' : 'Usuario actualizado'
            setModalMsgType('success')
            setModalMsg(msg)
            showToast(msg, 'edit', true)
            setTimeout(() => closeModal(), 1200)
          }
        } catch (err: any) {
          console.error('update user failed', err)
          if (modalData.password) {
            updateObj.passwordResetRequestedAt = new Date().toISOString()
            updateObj.passwordResetRequestedBy = (currentUser && (currentUser as any).email) || 'admin'
          }
          try { await (dataClientNow as any).setUserById(modalData.id, updateObj) } catch (e) {}
          const msg = modalData.password ? 'Usuario actualizado. Solicitud de cambio de contraseña registrada; aplica la contraseña desde un proceso seguro del servidor.' : 'Usuario actualizado (metadata)'
          setModalMsgType('success')
          setModalMsg(msg)
          showToast(msg, 'edit', true)
          setTimeout(() => closeModal(), 1200)
        }
      } else if (modalType === 'delete') {
        try {
          const token = await ((dataClientNow as any).getAccessToken ? (dataClientNow as any).getAccessToken() : (supabaseClient as any).getAccessToken())
          if (!token) throw new Error('Debes iniciar sesión como administrador para eliminar usuarios')
          const resp = await fetch('/api/delete_user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ legacyKey: modalData.id, email: modalData.email })
          })
          if (!resp.ok) {
            let errBody: any = {}
            try { errBody = await resp.json() } catch (e) {}
            const msg = (errBody && errBody.error) ? String(errBody.error) : `Error eliminando usuario (${resp.status})`
            // fallback: always remove metadata locally if server errored
            try { await (dataClientNow as any).removeUserById(modalData.id) } catch (e) {}
            setModalMsgType('error')
            setModalMsg(msg)
            showToast(msg, 'delete', false)
          } else {
            // Parse result payload to determine what was actually deleted
            let body: any = {}
            try { body = await resp.json() } catch (e) { body = {} }
            const r = body && body.result ? body.result : {}
            const authDeleted = !!r.authDeleted
            const appDeleted = !!r.appDeleted
            let msg = 'Usuario eliminado'
            if (authDeleted && appDeleted) msg = 'Usuario eliminado (Auth + metadata)'
            else if (!authDeleted && appDeleted) msg = 'Usuario eliminado (metadata). Cuenta Auth no encontrada o ya eliminada.'
            else if (authDeleted && !appDeleted) msg = 'Cuenta Auth eliminada; metadata no encontrada.'
            else msg = 'Operación completada, pero no se encontró usuario en Auth ni metadata.'
            setModalMsgType('success')
            setModalMsg(msg)
            showToast(msg, 'delete', true)
            setTimeout(() => closeModal(), 1200)
          }
        } catch (err: any) {
          console.error('modal delete failed', err)
          try { await (dataClientNow as any).removeUserById(modalData.id) } catch (e) {}
          const msg = 'Usuario eliminado (metadata)'
          setModalMsgType('success')
          setModalMsg(msg)
          showToast(msg, 'delete', true)
          setTimeout(() => closeModal(), 1200)
        }
      }

      const u = await (dataClientNow as any).getUsersOnce()
      setUsersList(u || [])
      setModalLoading(false)
      // keep modal open so the user can see the modal-local message; they can close it manually
    } catch (err: any) {
      console.error('modal save failed', err)
      const msg = (err && err.message) ? String(err.message) : 'Error en la operación'
      setModalMsgType('error')
      setModalMsg(msg)
      showToast(msg, modalType || 'edit', false)
      setModalLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!isAdmin) return
    try {
      const ok = window.confirm('¿Eliminar este usuario? Esta acción no se puede deshacer.')
      if (!ok) return
      // Try server-side deletion via admin endpoint; fallback to metadata removal
      const user = (usersList || []).find(u => ((u as any).legacyKey || (u as any).id) === id || (u as any).id === id)
      const email = user ? (user as any).email : undefined
      const token = await ((dataClientNow as any).getAccessToken ? (dataClientNow as any).getAccessToken() : (supabaseClient as any).getAccessToken())
      if (token) {
        const resp = await fetch('/api/delete_user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ legacyKey: id, email })
        })
        if (!resp.ok) {
          if (resp.status === 404) {
            await (dataClientNow as any).removeUserById(id)
          } else {
            const errBody: any = await resp.json().catch(() => ({}))
            throw new Error(errBody.error || `Error ${resp.status}`)
          }
        }
      } else {
        await (dataClientNow as any).removeUserById(id)
      }
      const u = await (dataClientNow as any).getUsersOnce()
      setUsersList(u || [])
      setUserMsgType('success')
      setUserMsg('Usuario eliminado')
    } catch (e) { console.error('delete user error', e); setUserMsgType('error'); setUserMsg('Error al eliminar usuario') }
  }

  return (
    <div id="configuration-root" className="min-h-screen bg-slate-50/50 pb-20" aria-hidden={modalOpen}>
      {/* Header Splash Premium */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div id="config-header-inner" className="px-5 sm:px-8 py-10 md:py-16 max-w-7xl mx-auto">
          <div id="config-header-title-row" className="flex items-center gap-3 mb-2 animate-fade-in-up">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20 text-white shrink-0">
              <span className="material-symbols-outlined text-xl">settings</span>
            </div>
            <h1 className="text-slate-900 dark:text-slate-50 text-2xl md:text-3xl font-black leading-tight tracking-[-0.033em]" style={{ margin: 0 }}>Configuración</h1>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm md:text-base max-w-2xl animate-fade-in-up" style={{ animationDelay: '50ms' }}>
            Gestiona las preferencias de tu cuenta, actualiza tu seguridad y administra los usuarios del sistema.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 relative z-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Tarjeta de Seguridad y Cuenta */}
          <div className={`${isAdmin ? 'lg:col-span-4' : 'lg:col-span-6 lg:col-start-4'} w-full animate-fade-in-up`} style={{ animationDelay: '100ms' }}>
            <div className="bg-white/90 backdrop-blur-xl border border-slate-200/80 shadow-xl shadow-slate-300/50 rounded-3xl overflow-hidden flex flex-col h-full">
              {/* Header de la Tarjeta */}
              <div className="px-6 py-5 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm shrink-0">
                  <span className="material-symbols-outlined text-[24px]">verified_user</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 leading-tight">Seguridad</h3>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Gestiona tu contraseña</p>
                </div>
              </div>

              <div className="p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-8 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-inner">
                  <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-md">
                    {email ? email.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Usuario Activo</p>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{email || 'Invitado'}</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Nueva contraseña</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                        <span className="material-symbols-outlined text-[20px]">lock_open</span>
                      </div>
                      <input 
                        autoComplete="new-password" 
                        type={showNewPassword ? 'text' : 'password'} 
                        value={newPassword} 
                        onChange={(e) => setNewPassword(e.target.value)} 
                        className="w-full bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-2xl pl-11 pr-12 py-3.5 text-sm font-semibold transition-all outline-none text-slate-700 dark:text-slate-200"
                        placeholder="••••••••"
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowNewPassword(s => !s)} 
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-blue-500 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[20px]">{showNewPassword ? 'visibility_off' : 'visibility'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Confirmar contraseña</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                        <span className="material-symbols-outlined text-[20px]">enhanced_encryption</span>
                      </div>
                      <input 
                        autoComplete="new-password" 
                        type={showConfirmPassword ? 'text' : 'password'} 
                        value={confirmPassword} 
                        onChange={(e) => setConfirmPassword(e.target.value)} 
                        className="w-full bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-2xl pl-11 pr-12 py-3.5 text-sm font-semibold transition-all outline-none text-slate-700 dark:text-slate-200"
                        placeholder="••••••••"
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowConfirmPassword(s => !s)} 
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-blue-500 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[20px]">{showConfirmPassword ? 'visibility_off' : 'visibility'}</span>
                      </button>
                    </div>
                  </div>

                  {message && (
                    <div className={`p-4 rounded-xl flex items-center gap-3 text-xs font-bold animate-in fade-in slide-in-from-top-2 ${msgType === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                      <span className="material-symbols-outlined text-base">{msgType === 'success' ? 'check_circle' : 'error'}</span>
                      {message}
                    </div>
                  )}

                  <div className="pt-2">
                    <button 
                      type="submit" 
                      disabled={loading || !newPassword || !confirmPassword} 
                      className={`w-full flex items-center justify-center gap-2 py-4 px-6 rounded-2xl font-black text-sm transition-all shadow-lg active:scale-[0.98] ${loading || !newPassword || !confirmPassword ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/30'}`}
                    >
                      {loading ? (
                        <><span className="material-symbols-outlined text-[18px] animate-spin">refresh</span> Actualizando...</>
                      ) : (
                        <><span className="material-symbols-outlined text-[20px]">save_as</span> Actualizar contraseña</>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>

          {/* Right: Gestión de Usuarios (Admin) */}
          {(adminVisible || isAdmin || (usersList && usersList.length > 0)) && (
            <div className="col-span-1 lg:col-span-8 w-full animate-fade-in-up" style={{ animationDelay: '200ms' }}>
              <div className="bg-white/90 backdrop-blur-xl border border-slate-200/80 shadow-xl shadow-slate-300/50 rounded-3xl overflow-hidden flex flex-col h-full">
                
                {/* Header de la Tarjeta con Buscador Integrado */}
                <div className="px-6 py-5 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-900 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm shrink-0">
                        <span className="material-symbols-outlined text-[24px]">manage_accounts</span>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 leading-tight">Gestión de Usuarios</h3>
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Administra accesos y roles</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1 sm:w-64">
                         <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                         <input 
                           placeholder="Buscar por email..." 
                           value={searchQ} 
                           onChange={e => { setSearchQ(e.target.value); setPage(1) }} 
                           className="w-full pl-9 pr-3 py-2 bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-400/10 transition-all text-slate-700 dark:text-slate-200" 
                         />
                      </div>
                      <button 
                        onClick={openCreateModal}
                        className="p-2 sm:px-4 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-[0.98] flex items-center gap-2 font-bold text-xs shrink-0"
                      >
                        <span className="material-symbols-outlined text-[18px]">person_add</span>
                        <span className="hidden sm:inline">Crear Usuario</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col">
                  {usersLoading ? (
                    <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-3">
                      <span className="material-symbols-outlined text-[40px] animate-spin">progress_activity</span>
                      <p className="text-sm font-bold">Cargando usuarios...</p>
                    </div>
                  ) : (
                    (() => {
                      const filtered = usersList.filter(u => String(u.email || '').toLowerCase().includes(searchQ.toLowerCase()))
                      const total = filtered.length
                      const pages = Math.max(1, Math.ceil(total / pageSize))
                      const current = Math.min(page, pages)
                      const start = (current - 1) * pageSize
                      const pageItems = filtered.slice(start, start + pageSize)

                      if (total === 0) {
                        return (
                          <div className="p-12 flex flex-col items-center justify-center text-center">
                            <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-4">
                              <span className="material-symbols-outlined text-[32px] text-slate-300">person_search</span>
                            </div>
                            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">No se encontraron usuarios</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[200px]">Intenta con otro término de búsqueda o crea uno nuevo.</p>
                          </div>
                        )
                      }

                      return (
                        <div className="flex flex-col h-full">
                          {/* Listado Header (Desktop) */}
                          <div className="hidden sm:grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-400">
                            <div className="col-span-8">Información de Usuario</div>
                            <div className="col-span-2">Rol</div>
                            <div className="col-span-2 text-right">Acciones</div>
                          </div>

                          <div className="flex-1 overflow-y-auto">
                            {pageItems.map((u, i) => (
                              <div 
                                key={u.id} 
                                className="group px-6 py-4 border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/80 dark:hover:bg-indigo-900/10 transition-all grid grid-cols-1 sm:grid-cols-12 items-center gap-4"
                                style={{ animationDelay: `${150 + (i * 50)}ms` }}
                              >
                                {/* Mobile/Desktop Email & Avatar */}
                                <div className="col-span-1 border-blue-600 sm:col-span-8 flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 font-bold text-xs shrink-0 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                                    {(u.email || 'U').charAt(0).toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{u.email}</p>
                                    <p className="text-[10px] text-slate-400 font-semibold sm:hidden mt-0.5 uppercase tracking-wide">{u.role || 'profesor'}</p>
                                  </div>
                                </div>

                                {/* Desktop Role */}
                                <div className="hidden sm:block col-span-2">
                                  <span className={`inline-flex px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${u.role === 'admin' ? 'bg-purple-50 text-purple-700 border border-purple-100' : 'bg-blue-50 text-blue-700 border border-blue-100'}`}>
                                    {u.role || 'profesor'}
                                  </span>
                                </div>


                                {/* Acciones */}
                                <div className="col-span-1 sm:col-span-2 flex items-center justify-end gap-1.5">
                                  <button 
                                    onClick={() => openEditModal(u)}
                                    className="w-10 h-10 flex items-center justify-center bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-xl transition-all active:scale-[0.9] shadow-sm shadow-blue-600/5"
                                    title="Editar"
                                  >
                                    <span className="material-symbols-outlined text-[20px]">edit_square</span>
                                  </button>
                                  <button 
                                    onClick={() => openDeleteModal(u)}
                                    className="w-10 h-10 flex items-center justify-center bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-xl transition-all active:scale-[0.9] shadow-sm shadow-red-600/5"
                                    title="Eliminar"
                                  >
                                    <span className="material-symbols-outlined text-[20px]">delete</span>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Pagination Footer */}
                          <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              Mostrando <span className="text-slate-700 dark:text-slate-200">{start + 1}-{Math.min(start + pageSize, total)}</span> de <span className="text-slate-700 dark:text-slate-200">{total}</span> usuarios
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex gap-1">
                                <button 
                                  disabled={current <= 1} 
                                  onClick={() => setPage(p => Math.max(1, p - 1))}
                                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${current <= 1 ? 'text-slate-300 cursor-not-allowed' : 'bg-white dark:bg-slate-800 text-slate-600 border border-slate-200 dark:border-slate-700 hover:border-blue-300 hover:text-blue-600 shadow-sm'}`}
                                >
                                  <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                                </button>
                                <button 
                                  disabled={current >= pages} 
                                  onClick={() => setPage(p => Math.min(pages, p + 1))}
                                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${current >= pages ? 'text-slate-300 cursor-not-allowed' : 'bg-white dark:bg-slate-800 text-slate-600 border border-slate-200 dark:border-slate-700 hover:border-blue-300 hover:text-blue-600 shadow-sm'}`}
                                >
                                  <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                                </button>
                              </div>
                              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                Página <span className="text-slate-700 dark:text-slate-200">{current}</span> de <span className="text-slate-700 dark:text-slate-200">{pages}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })()
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Modal overlay — bottom-sheet en mobile, centrado en desktop */}
      {isAdmin && (
        <Modal isOpen={modalOpen} onClose={closeModal} maxWidth="max-w-lg" hideMobileIndicator={true} scrollableBody={false}>
          <div className="flex flex-col h-full sm:max-h-[80vh] relative overflow-hidden bg-slate-50 dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl">
            {/* Drag handle for mobile */}
            <div className="w-full flex justify-center pt-2 pb-3 sm:hidden absolute top-0 z-20 cursor-pointer" style={{ touchAction: 'none' }} onClick={closeModal}>
              <div className="w-12 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 shrink-0 rounded-t-3xl sm:rounded-[1.5rem] sm:rounded-b-none pt-7 sm:pt-4 z-10 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="text-lg sm:text-xl font-black text-slate-800 dark:text-slate-100 truncate tracking-tight">
                {modalType === 'edit' ? 'Editar usuario' : (modalType === 'delete' ? 'Confirmar eliminación' : 'Crear usuario')}
              </div>
              <div className="hidden sm:block">
                <button
                  type="button"
                  onClick={closeModal}
                  className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors outline-none"
                >
                  <span className="material-symbols-outlined text-[24px]">close</span>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="modal-scrollable-content p-6 flex-1 overflow-y-auto">
              {modalType === 'delete' ? (
                <div>
                  <p>¿Eliminar usuario <strong>{modalData.email}</strong>?</p>
                  <div className="mt-4 flex flex-col sm:flex-row-reverse justify-end gap-2">
                    <button className="w-full sm:w-auto px-8 py-3 sm:py-2 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl shadow-lg shadow-red-600/30 transition-all active:scale-[0.98]" onClick={confirmModalSave} disabled={modalLoading}>{modalLoading ? 'Eliminando...' : 'Eliminar'}</button>
                    <button className="w-full sm:w-auto px-6 py-3 sm:py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 transition-all text-sm border border-slate-200 dark:border-slate-700" onClick={closeModal} disabled={modalLoading}>Cancelar y Volver</button>
                  </div>
                </div>
              ) : (
                <form onSubmit={async (e) => { e.preventDefault(); await confirmModalSave(); }} className="space-y-3">
                  <input type="text" name="username" autoComplete="username" value={modalData.email || ''} readOnly aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }} />
                  <div>
                    <label className="block text-sm">Correo</label>
                    <input name="newUserEmail" autoComplete="email" className="w-full border px-3 py-2 rounded" value={modalData.email} onChange={e => setModalData({...modalData, email: e.target.value})} />
                  </div>
                  {modalType === 'create' && (
                    <div>
                      <label className="block text-sm">Contraseña</label>
                      <div className="relative">
                        <input name="newUserPassword" autoComplete="new-password" className="w-full border px-3 py-2 rounded" type={modalShowPassword ? 'text' : 'password'} value={modalData.password || ''} onChange={e => setModalData({...modalData, password: e.target.value})} />
                        <button type="button" className={`password-toggle ${modalShowPassword ? 'active' : ''}`} onClick={() => setModalShowPassword(s => !s)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }} aria-pressed={modalShowPassword} aria-label={modalShowPassword ? 'Ocultar' : 'Mostrar'}>
                          <i className={`fas ${modalShowPassword ? 'fa-eye-slash' : 'fa-eye'}`} aria-hidden="true"></i>
                        </button>
                      </div>
                    </div>
                  )}
                  {modalType === 'edit' && (
                    <div>
                      <label className="block text-sm">Cambiar contraseña (opcional)</label>
                      <div className="relative">
                        <input name="editUserPassword" autoComplete="new-password" className="w-full border px-3 py-2 rounded" type={modalShowPassword ? 'text' : 'password'} value={modalData.password || ''} onChange={e => setModalData({...modalData, password: e.target.value})} />
                        <button type="button" className={`password-toggle ${modalShowPassword ? 'active' : ''}`} onClick={() => setModalShowPassword(s => !s)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }} aria-pressed={modalShowPassword} aria-label={modalShowPassword ? 'Ocultar' : 'Mostrar'}>
                          <i className={`fas ${modalShowPassword ? 'fa-eye-slash' : 'fa-eye'}`} aria-hidden="true"></i>
                        </button>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">La nueva contraseña se aplica desde un proceso seguro del servidor.</div>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm">Rol</label>
                    <select className="border px-2 py-2 rounded w-full" value={modalData.role} onChange={e => setModalData({...modalData, role: e.target.value})}>
                      <option value="profesor">Profesor</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>

                  <div className="mt-4 flex flex-col sm:flex-row-reverse justify-end gap-2">
                    <button type="submit" className="w-full sm:w-auto px-8 py-3 sm:py-2.5 bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 border border-blue-600 hover:border-blue-700 disabled:opacity-60 text-white font-black rounded-2xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),0_4px_14px_0_rgba(37,99,235,0.3)] transition-all text-sm active:scale-[0.98] outline-none" disabled={modalLoading}>{modalLoading ? 'Guardando...' : (modalType === 'edit' ? 'Guardar' : 'Crear')}</button>
                    <button type="button" className="w-full sm:w-auto px-6 py-3 sm:py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 transition-all text-sm border border-slate-200 dark:border-slate-700" onClick={closeModal} disabled={modalLoading}>Cancelar y Volver</button>
                  </div>
                </form>
              )}
              {modalMsg && (
                <div className={`mt-4 p-3 rounded text-sm ${modalMsgType === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{modalMsg}</div>
              )}
            </div>
          </div>
        </Modal>
      )} 
      {/* Confirm password change modal — bottom-sheet pattern */}
      <Modal isOpen={confirmPwdOpen} onClose={() => setConfirmPwdOpen(false)} maxWidth="max-w-sm" hideMobileIndicator={true} scrollableBody={false}>
        <div className="flex flex-col h-full sm:max-h-[85vh] relative overflow-hidden bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl">
          {/* Drag handle */}
          <div className="w-full flex justify-center pt-2 pb-3 sm:hidden absolute top-0 z-20 cursor-pointer" style={{ touchAction: 'none' }} onClick={() => setConfirmPwdOpen(false)}>
            <div className="w-12 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 shrink-0 rounded-t-3xl sm:rounded-[1.5rem] sm:rounded-b-none pt-7 sm:pt-4 z-10 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
            <span className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight">Confirmar cambio</span>
            <div className="hidden sm:block">
              <button type="button" onClick={() => setConfirmPwdOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors outline-none">
                <span className="material-symbols-outlined text-[24px]">close</span>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="modal-scrollable-content p-5 overflow-y-auto">
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-5">¿Confirmas que deseas cambiar tu contraseña? Esta acción no se puede deshacer.</p>
            <div className="flex flex-col sm:flex-row-reverse gap-3 justify-end">
              <button type="button" onClick={doChangePassword} className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-lg shadow-blue-600/30 transition-all text-sm active:scale-[0.98]">Sí, cambiar</button>
              <button type="button" onClick={() => setConfirmPwdOpen(false)} className="w-full sm:w-auto px-6 py-3 sm:py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 transition-all text-sm border border-slate-200 dark:border-slate-700">Cancelar y Volver</button>
            </div>
          </div>
        </div>
      </Modal>
      {/* Toast global — renderizado por ToastProvider en App.tsx */}
      
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.4s ease-out forwards;
          opacity: 0;
        }
        @media (max-width: 767px) {
          #config-header-title-row {
            justify-content: flex-start !important;
            align-items: center !important;
          }
          #config-header-inner {
            text-align: left !important;
          }
        }
      `}</style>
    </div>
  )
}
