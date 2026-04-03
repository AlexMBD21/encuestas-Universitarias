
import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom';
import supabaseClient from '../../services/supabaseClient'
import AuthAdapter from '../../services/AuthAdapter'
import { useAuth } from '../../services/AuthContext'
import Toast from '../../components/Toast'

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
  const [editingUser, setEditingUser] = useState<any | null>(null)
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserRole, setNewUserRole] = useState<'profesor' | 'admin'>('profesor')
  const [usersLoading, setUsersLoading] = useState(false)
  const [userMsg, setUserMsg] = useState<string | null>(null)
  const [userMsgType, setUserMsgType] = useState<'success' | 'error'>('success')
  const [searchQ, setSearchQ] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10
  // modal state for create/edit/delete
  const [modalOpen, setModalOpen] = useState(false)
  const [modalType, setModalType] = useState<'create' | 'edit' | 'delete' | null>(null)
  const [modalData, setModalData] = useState<any>({ email: '', role: 'profesor', password: '' })
  const [modalLoading, setModalLoading] = useState(false)
  const [modalShowPassword, setModalShowPassword] = useState(false)
  const [modalMsg, setModalMsg] = useState<string | null>(null)
  const [modalMsgType, setModalMsgType] = useState<'success' | 'error'>('success')
  // toast state
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [toastKind, setToastKind] = useState<'create' | 'edit' | 'delete' | 'info'>('info')
  const [toastVisible, setToastVisible] = useState(false)
  const toastTimerRef = useRef<number | null>(null)

  const showToast = (msg: string | null, kind: 'create' | 'edit' | 'delete' | 'info' = 'info', autoHide: boolean = true) => {
    try {
      if (!msg) return
      setToastMsg(msg)
      setToastKind(kind)
      setToastVisible(true)
      if (toastTimerRef.current) {
        try { window.clearTimeout(toastTimerRef.current) } catch (e) {}
        toastTimerRef.current = null
      }
      if (autoHide) {
        toastTimerRef.current = window.setTimeout(() => {
          setToastVisible(false)
          toastTimerRef.current = null
        }, 3500)
      }
    } catch (e) {}
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

  const handleSubmit = async (e: React.FormEvent) => {
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
    setLoading(true)
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

  const handleEdit = (u: any) => {
    setEditingUser({ ...u })
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
    <div id="configuration-root" className="p-6" aria-hidden={modalOpen}>

      
      {/* Account configuration (visible to professors) and Admin users management */}
      <div className={isAdmin ? 'max-w-5xl mx-auto mt-8' : 'max-w-3xl mx-auto mt-8'}>
        <div className="flex flex-col md:flex-row gap-6">
          {/* Left: account config */}
          <div className={isAdmin ? 'w-full md:w-2/5' : 'w-full'}>
              <h3 className="text-lg font-semibold mb-3">Configuración de cuenta</h3>
              <div className="mb-4 text-sm text-slate-600">Usuario: <strong>{email || 'Invitado'}</strong></div>
              <form onSubmit={handleSubmit} className="space-y-3">
                {/* Removed current-password input per UI request */}
                <div>
                  <label className="block text-sm">Nueva contraseña</label>
                  <div className="relative">
                    <input autoComplete="new-password" type={showNewPassword ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full border px-3 py-2 rounded" />
                    <button type="button" className={`password-toggle ${showNewPassword ? 'active' : ''}`} onClick={() => setShowNewPassword(s => !s)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }} aria-pressed={showNewPassword} aria-label={showNewPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                      <i className={`fas ${showNewPassword ? 'fa-eye-slash' : 'fa-eye'}`} aria-hidden="true"></i>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm">Confirmar nueva contraseña</label>
                  <div className="relative">
                    <input autoComplete="new-password" type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full border px-3 py-2 rounded" />
                    <button type="button" className={`password-toggle ${showConfirmPassword ? 'active' : ''}`} onClick={() => setShowConfirmPassword(s => !s)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }} aria-pressed={showConfirmPassword} aria-label={showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                      <i className={`fas ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'}`} aria-hidden="true"></i>
                    </button>
                  </div>
                </div>
                <div className="text-right">
                  <button type="submit" disabled={loading} className={`btn btn-primary ${loading ? 'btn-disabled' : ''}`}>
                    {loading ? 'Guardando...' : 'Cambiar contraseña'}
                  </button>
                </div>
              </form>
            </div>

          {/* Right: users management (solo administradores). Keep visible if usersList already loaded to avoid flicker when admin flag briefly disappears. */}
          {(adminVisible || isAdmin || (usersList && usersList.length > 0)) && (
            <div className="w-full md:w-3/5 md:pl-6">
              <h3 className="text-lg font-semibold mb-3">Gestión de usuarios</h3>
                <div className="mb-3">
                <div className="flex items-center gap-2 action-buttons">
                  <button className="btn btn-primary" onClick={openCreateModal}>Crear usuario</button>
                </div>
              </div>

              <div className="mb-2">
                <input placeholder="Buscar por email" value={searchQ} onChange={e => { setSearchQ(e.target.value); setPage(1) }} className="w-full border px-3 py-2 rounded" />
              </div>

              <div>
                {usersLoading ? <div>Cargando usuarios...</div> : (
                  (() => {
                    const filtered = usersList.filter(u => String(u.email || '').toLowerCase().includes(searchQ.toLowerCase()))
                    const total = filtered.length
                    const pages = Math.max(1, Math.ceil(total / pageSize))
                    const current = Math.min(page, pages)
                    const start = (current - 1) * pageSize
                    const pageItems = filtered.slice(start, start + pageSize)
                    return (
                      <>
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b"><th className="p-2">Email</th><th className="p-2">Rol</th><th className="p-2">Acciones</th></tr>
                          </thead>
                          <tbody>
                            {pageItems.map(u => (
                                  <tr key={u.id} className="border-b">
                                      <td className="p-2 text-sm" data-label="Email">{u.email}</td>
                                      <td className="p-2 text-sm" data-label="Rol">{u.role || 'profesor'}</td>
                                      <td className="p-2 text-sm" data-label="Acciones">
                                        <button className="px-2 py-1 mr-2 rounded btn btn-outline" onClick={() => openEditModal(u)}>Editar</button>
                                        <button className="px-2 py-1 rounded btn btn-danger" onClick={() => openDeleteModal(u)}>Eliminar</button>
                                      </td>
                                    </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="flex items-center justify-between mt-2 text-sm pagination-row">
                          <div className="pagination-summary">{total === 0 ? 'Sin usuarios' : `Mostrando ${start + 1}-${Math.min(start + pageSize, total)} de ${total}`}</div>
                          <div className="flex items-center gap-2 pagination-controls">
                            <div className="pagination-buttons flex gap-2">
                              <button disabled={current <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className={`btn btn-pagination ${current <= 1 ? 'btn-disabled' : ''}`} aria-disabled={current <= 1}>Anterior</button>
                              <button disabled={current >= pages} onClick={() => setPage(p => Math.min(pages, p + 1))} className={`btn btn-pagination ${current >= pages ? 'btn-disabled' : ''}`} aria-disabled={current >= pages}>Siguiente</button>
                            </div>
                            <div className="page-label">Página {current} / {pages}</div>
                          </div>
                        </div>
                      </>
                    )
                  })()
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Modal overlay */}
      {isAdmin && modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="relative w-full max-w-lg mx-4">
            <div className={`bg-white rounded shadow-lg overflow-hidden`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
              {/* Header */}
              <div id="modal-header" className="sticky top-0 z-10 border-b px-5 py-3 flex items-center text-white" style={{ background: 'var(--color-primary)', boxShadow: 'inset 0 8px 18px rgba(0,0,0,0.28), inset 0 -6px 12px rgba(255,255,255,0.04), 0 6px 24px rgba(15,23,42,0.08)', borderTopLeftRadius: 'inherit', borderTopRightRadius: 'inherit', top: '-1px' }}>
                <div id="modal-title" className="text-lg font-semibold truncate mr-4">{modalType === 'edit' ? 'Editar usuario' : (modalType === 'delete' ? 'Confirmar eliminación' : 'Crear usuario')}</div>
              </div>

              {/* Content */}
              <div className="p-6">
                {modalType === 'delete' ? (
                  <div>
                    <p>¿Eliminar usuario <strong>{modalData.email}</strong>?</p>
                    <div className="mt-4 flex justify-end gap-2">
                      <button className="btn btn-ghost" onClick={closeModal} disabled={modalLoading}>Cancelar</button>
                      <button className="btn btn-danger" onClick={confirmModalSave} disabled={modalLoading}>{modalLoading ? 'Eliminando...' : 'Eliminar'}</button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={async (e) => { e.preventDefault(); await confirmModalSave(); }} className="space-y-3">
                    {/* Hidden username field for password managers / accessibility */}
                    <input
                      type="text"
                      name="username"
                      autoComplete="username"
                      value={modalData.email || ''}
                      readOnly
                      aria-hidden="true"
                      style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}
                    />
                    <div>
                      <label className="block text-sm">Correo</label>
                      <input name="newUserEmail" autoComplete="email" autoFocus={modalType === 'create'} className="w-full border px-3 py-2 rounded" value={modalData.email} onChange={e => setModalData({...modalData, email: e.target.value})} />
                    </div>
                    {modalType === 'create' && (
                      <div>
                        <label className="block text-sm">Contraseña</label>
                        <div className="relative">
                          <input name="newUserPassword" autoComplete="new-password" className="w-full border px-3 py-2 rounded" type={modalShowPassword ? 'text' : 'password'} value={modalData.password || ''} onChange={e => setModalData({...modalData, password: e.target.value})} />
                          <button type="button" className={`password-toggle ${modalShowPassword ? 'active' : ''}`} onClick={() => setModalShowPassword(s => !s)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }} aria-pressed={modalShowPassword} aria-label={modalShowPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
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
                          <button type="button" className={`password-toggle ${modalShowPassword ? 'active' : ''}`} onClick={() => setModalShowPassword(s => !s)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }} aria-pressed={modalShowPassword} aria-label={modalShowPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                            <i className={`fas ${modalShowPassword ? 'fa-eye-slash' : 'fa-eye'}`} aria-hidden="true"></i>
                          </button>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">La nueva contraseña no se guardará en el repositorio; un proceso seguro del servidor debe aplicar el cambio.</div>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm">Rol</label>
                      <select className="border px-2 py-2 rounded w-full" value={modalData.role} onChange={e => setModalData({...modalData, role: e.target.value})}>
                        <option value="profesor">Profesor</option>
                        <option value="admin">Administrador</option>
                      </select>
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                      <button type="button" className="btn btn-ghost" onClick={closeModal} disabled={modalLoading}>Cancelar</button>
                      <button type="submit" className="btn btn-primary" disabled={modalLoading}>{modalLoading ? 'Guardando...' : (modalType === 'edit' ? 'Guardar' : 'Crear')}</button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      <Toast visible={toastVisible} message={toastMsg} kind={toastKind} onClose={() => { setToastVisible(false); if (toastTimerRef.current) { try { window.clearTimeout(toastTimerRef.current) } catch (e) {} toastTimerRef.current = null } }} />
    </div>
  )
}
