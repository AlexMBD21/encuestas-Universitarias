
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
  const pageSize = 5

  const defaultAsignaturas = ["Matemáticas", "Ingeniería de Software", "Finanzas", "Tecnología", "Salud", "Ciencias Básicas", "Ciencias Sociales", "Negocios"]
  const [globalAsignaturas, setGlobalAsignaturas] = useState<string[]>(defaultAsignaturas)
  const [loadingAsig, setLoadingAsig] = useState(false)
  const [newAsig, setNewAsig] = useState('')

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
  // modal animation state (bottom-sheet)
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [isPwdModalVisible, setIsPwdModalVisible] = useState(false)
  const [pullDownY, setPullDownY] = useState(0)
  const [pullDownPwdY, setPullDownPwdY] = useState(0)
  const touchStartRef = useRef({ y: 0, scrollY: 0 })
  const userModalRef = useRef<HTMLDivElement | null>(null)
  const pwdModalRef = useRef<HTMLDivElement | null>(null)
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
        // Load settings for asignaturas
        if (dataClientNow.getSurveyById) {
          try {
            const sys = await dataClientNow.getSurveyById('sys_settings_asignaturas')
            if (sys && Array.isArray(sys.rubric) && sys.rubric.length > 0) {
              setGlobalAsignaturas(sys.rubric)
            }
          } catch(err) { /* no settings survey yet */ }
        }
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

  const saveGlobalAsignaturas = async (newList: string[]) => {
    try {
      setLoadingAsig(true)
      const dataClientNow: any = supabaseClient
      if (dataClientNow.setSurvey) {
        await dataClientNow.setSurvey('sys_settings_asignaturas', {
          id: 'sys_settings_asignaturas',
          title: 'System Settings',
          type: 'system',
          published: true,
          ownerId: 'admin',
          rubric: newList
        })
        setGlobalAsignaturas(newList)
        showToast('Asignaturas actualizadas', 'edit', true)
      }
    } catch (e) {
      console.error('Error saving asignaturas', e)
      showToast('Error al guardar asignaturas', 'delete', false)
    } finally {
      setLoadingAsig(false)
    }
  }

  const handleAddAsig = () => {
    const val = newAsig.trim()
    if (!val || globalAsignaturas.some(a => a.toLowerCase() === val.toLowerCase())) return
    const updated = [...globalAsignaturas, val]
    saveGlobalAsignaturas(updated)
    setNewAsig('')
  }

  const handleRemoveAsig = (val: string) => {
    const updated = globalAsignaturas.filter(a => a !== val)
    saveGlobalAsignaturas(updated)
  }

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
    setTimeout(() => setIsPwdModalVisible(true), 50)
  }

  const doChangePassword = async () => {
    setConfirmPwdOpen(false)
    setIsPwdModalVisible(false)
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
    setModalData({ email: '', role: 'profesor', password: '', confirmPassword: '', asignatura: '' })
    setModalType('create')
    setModalShowPassword(false)
    setModalMsg(null)
    setModalMsgType('success')
    setModalOpen(true)
    setTimeout(() => setIsModalVisible(true), 50)
  }

  const openEditModal = (u: any) => {
    setModalData({ id: u.id, email: u.email, role: u.role || 'profesor', password: '', asignatura: u.asignatura || '' })
    setModalType('edit')
    setModalShowPassword(false)
    setModalMsg(null)
    setModalMsgType('success')
    setModalOpen(true)
    setTimeout(() => setIsModalVisible(true), 50)
  }

  const openDeleteModal = (u: any) => {
    setModalData({ id: u.id, email: u.email })
    setModalType('delete')
    setModalMsg(null)
    setModalMsgType('success')
    setModalOpen(true)
    setTimeout(() => setIsModalVisible(true), 50)
  }

  const closeModal = () => {
    setIsModalVisible(false)
    setPullDownY(0)
    setTimeout(() => {
      setModalOpen(false)
      setModalType(null)
      setModalData({ email: '', role: 'profesor', password: '', asignatura: '' })
      setModalLoading(false)
      setModalShowPassword(false)
    }, 300)
  }

  // Handle non-passive touchmove for pull-to-dismiss without browser pull-to-refresh
  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      // For Admin User Modal
      if (modalOpen && isModalVisible && !confirmPwdOpen) {
        if (touchStartRef.current.scrollY <= 0) {
          const delta = e.touches[0].clientY - touchStartRef.current.y;
          if (delta > 0) {
            if (e.cancelable) e.preventDefault();
            setPullDownY(delta);
          }
        }
      }
      // For Password confirmation modal
      if (confirmPwdOpen && isPwdModalVisible) {
        const delta = e.touches[0].clientY - touchStartRef.current.y;
        if (delta > 0) {
          if (e.cancelable) e.preventDefault();
          setPullDownPwdY(delta);
        }
      }
    };

    const opt: AddEventListenerOptions = { passive: false };
    const u = userModalRef.current;
    const p = pwdModalRef.current;

    if (u) u.addEventListener('touchmove', handleTouchMove, opt);
    if (p) p.addEventListener('touchmove', handleTouchMove, opt);

    return () => {
      if (u) u.removeEventListener('touchmove', handleTouchMove);
      if (p) p.removeEventListener('touchmove', handleTouchMove);
    };
  }, [modalOpen, isModalVisible, confirmPwdOpen, isPwdModalVisible]);

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
            body: JSON.stringify({ email: modalData.email, password: pwd, role: modalData.role || 'profesor', asignatura: modalData.asignatura || '' })
          })
          if (!resp.ok) {
            let errBody: any = {}
            try { errBody = await resp.json() } catch (e) {}
            try { await (dataClientNow as any).pushUser({ email: modalData.email, role: modalData.role, asignatura: modalData.asignatura }) } catch (e) {}
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
          await (dataClientNow as any).pushUser({ email: modalData.email, role: modalData.role, asignatura: modalData.asignatura })
          const msg = 'Usuario creado (metadata). Para crear la cuenta Auth, especifique una contraseña o use la función segura del servidor.'
          setModalMsgType('success')
          setModalMsg(msg)
          showToast(msg, 'create', true)
          setTimeout(() => closeModal(), 1200)
        }
      } else if (modalType === 'edit') {
        const updateObj: any = { email: modalData.email, role: modalData.role, asignatura: modalData.asignatura }
        try {
          const token = await ((dataClientNow as any).getAccessToken ? (dataClientNow as any).getAccessToken() : (supabaseClient as any).getAccessToken())
          if (!token) throw new Error('Debes iniciar sesión como administrador para aplicar cambios')
          const body: any = { legacyKey: modalData.id, email: modalData.email, role: modalData.role, asignatura: modalData.asignatura }
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
    <div id="configuration-root" className="min-h-screen bg-slate-50/50 pb-20" aria-hidden={modalOpen}>
      {/* Header Splash Premium */}
      <div className="bg-white border-b border-slate-200 shadow-md">
        <div id="config-header-inner" className="px-5 sm:px-8 py-8 md:py-12 max-w-7xl mx-auto">
          <div id="config-header-title-row" className="flex items-center gap-3 mb-2 animate-fade-in-up">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20 text-white shrink-0">
              <span className="material-symbols-outlined text-xl">settings</span>
            </div>
            <h1 className="text-slate-900 dark:text-slate-50 text-2xl md:text-3xl font-black leading-tight tracking-[-0.033em]" style={{ margin: 0 }}>Configuración</h1>
          </div>
          <p className="text-slate-500 text-sm md:text-base max-w-2xl animate-fade-in-up" style={{ animationDelay: '50ms' }}>
            Gestiona las preferencias de tu cuenta, actualiza tu seguridad y administra los usuarios del sistema.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {/* Account configuration (visible to professors) and Admin users management */}
        <div className={isAdmin ? 'max-w-full mx-auto' : 'max-w-3xl mx-auto'}>
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
                        {/* Desktop table */}
                        <table className="hidden sm:table w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b"><th className="p-2">Email</th><th className="p-2">Rol</th><th className="p-2">Asignatura</th><th className="p-2">Acciones</th></tr>
                          </thead>
                          <tbody>
                            {pageItems.map(u => (
                              <tr key={u.id} className="border-b">
                                <td className="p-2 text-sm">{u.email}</td>
                                <td className="p-2 text-sm">{u.role || 'profesor'}</td>
                                <td className="p-2 text-sm text-slate-500">{u.asignatura || '-'}</td>
                                <td className="p-2 text-sm">
                                  <button className="px-2 py-1 mr-2 rounded btn btn-outline" onClick={() => openEditModal(u)}>Editar</button>
                                  <button className="px-2 py-1 rounded btn btn-danger" onClick={() => openDeleteModal(u)}>Eliminar</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {/* Mobile cards */}
                        <div className="sm:hidden space-y-2">
                          {pageItems.map(u => (
                            <div key={u.id} className="border rounded-xl p-3 bg-slate-50 dark:bg-slate-800 flex flex-col gap-2">
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-sm font-medium break-all">{u.email}</span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 whitespace-nowrap shrink-0">{u.role || 'profesor'}</span>
                              </div>
                              {u.asignatura && (
                                <div className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">Asignatura: {u.asignatura}</div>
                              )}
                              <div className="flex gap-2">
                                <button className="flex-1 py-1.5 text-sm rounded-lg btn btn-outline" onClick={() => openEditModal(u)}>Editar</button>
                                <button className="flex-1 py-1.5 text-sm rounded-lg btn btn-danger" onClick={() => openDeleteModal(u)}>Eliminar</button>
                              </div>
                            </div>
                          ))}
                        </div>
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

              {/* Asignaturas Management Card */}
              <div className="mt-8 bg-white border border-slate-200 shadow-sm rounded-3xl p-6 sm:p-8 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[20px]">category</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">Gestión de Asignaturas Globales</h2>
                    <p className="text-sm text-slate-500">Modifica las disciplinas o asignaturas disponibles para los profesores.</p>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                   <div className="flex gap-2">
                     <input 
                       className="border px-4 py-2 rounded-xl flex-1 bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                       placeholder="Ej. Medicina, Psicología..."
                       value={newAsig}
                       onChange={e => setNewAsig(e.target.value)}
                       onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddAsig() } }}
                     />
                     <button 
                       className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 rounded-xl font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50 flex items-center gap-2"
                       onClick={handleAddAsig}
                       disabled={loadingAsig || !newAsig.trim()}
                     >
                       <span className="material-symbols-outlined text-[18px]">add</span>
                       Agregar
                     </button>
                   </div>
                   
                   <div className="flex flex-wrap gap-2 mt-2">
                     {globalAsignaturas.map(asig => (
                       <div key={asig} className="bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm text-slate-700 font-medium">
                         {asig}
                         <button 
                           onClick={() => handleRemoveAsig(asig)}
                           disabled={loadingAsig}
                           className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-0.5 rounded-md transition-colors"
                           title="Eliminar"
                         >
                           <span className="material-symbols-outlined text-[16px]">close</span>
                         </button>
                       </div>
                     ))}
                     {globalAsignaturas.length === 0 && (
                       <span className="text-sm text-slate-500 italic">No hay asignaturas registradas.</span>
                     )}
                   </div>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
      {/* Modal overlay — bottom-sheet en mobile, centrado en desktop */}
      {isAdmin && modalOpen && (
        <div className="fixed inset-0 flex items-end sm:items-center justify-center z-50 bg-slate-900/60 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}>
          <div className="relative w-full sm:max-w-lg sm:mx-4 sm:mb-0">
            <div
              className={`bg-slate-50 dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90dvh] sm:max-h-[80vh] transform transition-all duration-300 ${isModalVisible ? 'opacity-100 translate-y-0 sm:scale-100' : 'opacity-0 translate-y-full sm:translate-y-4 sm:scale-95'}`}
              ref={userModalRef}
              style={{
                overscrollBehaviorY: 'contain',
                ...(pullDownY > 0 ? { transform: `translateY(${pullDownY}px)`, transition: 'none' } : undefined)
              }}
              onTouchStart={(e) => { const sc = e.currentTarget.querySelector('.overflow-y-auto'); touchStartRef.current = { y: e.touches[0].clientY, scrollY: sc ? sc.scrollTop : 0 } }}
              onTouchEnd={() => { if (pullDownY > 80) closeModal(); setPullDownY(0) }}
              role="dialog" aria-modal="true" aria-labelledby="modal-title"
            >
              {/* Drag handle — absolute inside modal, only mobile */}
              <div className="w-full flex justify-center pt-2 pb-3 sm:hidden absolute top-0 z-20 cursor-pointer" style={{ backgroundColor: 'var(--color-primary)', touchAction: 'none' }} onClick={closeModal}>
                <div className="w-12 h-1.5 rounded-full bg-white/40" />
              </div>

              {/* Header — pt-7 mobile to clear the handle, pt-4 desktop */}
              <div id="modal-header" className="sticky top-0 z-10 border-b px-4 sm:px-6 py-4 flex items-center text-white flex-shrink-0 pt-7 sm:pt-4" style={{ backgroundColor: 'var(--color-primary)', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', borderTopLeftRadius: 'inherit', borderTopRightRadius: 'inherit', top: '-1px', touchAction: 'none' }}>
                <div id="modal-title" className="text-lg sm:text-xl font-bold truncate mr-4 tracking-wide">{modalType === 'edit' ? 'Editar usuario' : (modalType === 'delete' ? 'Confirmar eliminación' : 'Crear usuario')}</div>
                {/* X button: hidden on mobile, visible on desktop */}
                <div className="ml-auto hidden sm:block">
                  <button type="button" onClick={closeModal} aria-label="Cerrar" title="Cerrar" className="w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors">
                    <span className="material-symbols-outlined text-[22px]">close</span>
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 flex-1 overflow-y-auto">
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
                    {modalData.role !== 'admin' && (
                      <div>
                        <label className="block text-sm">Asignatura (Categoría de Proyectos a Evaluar)</label>
                        <select
                          name="newUserAsignatura"
                          className="w-full border px-3 py-2 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                          value={modalData.asignatura || ''}
                          onChange={e => setModalData({...modalData, asignatura: e.target.value})}
                        >
                          <option value="">-- Selecciona una asignatura --</option>
                          {globalAsignaturas.map(asig => (
                            <option key={asig} value={asig}>{asig}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="mt-4 flex justify-end gap-2">
                      <button type="button" className="btn btn-ghost" onClick={closeModal} disabled={modalLoading}>Cancelar</button>
                      <button type="submit" className="btn btn-primary" disabled={modalLoading}>{modalLoading ? 'Guardando...' : (modalType === 'edit' ? 'Guardar' : 'Crear')}</button>
                    </div>
                  </form>
                )}
                {modalMsg && (
                  <div className={`mt-4 p-3 rounded text-sm ${modalMsgType === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{modalMsg}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )} 
      {/* Confirm password change modal — bottom-sheet pattern */}
      {confirmPwdOpen && (
        <div className="fixed inset-0 z-[10001] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) { setIsPwdModalVisible(false); setPullDownPwdY(0); setTimeout(() => setConfirmPwdOpen(false), 300) } }}>
          <div className="relative w-full sm:max-w-sm sm:mx-4 sm:mb-0">
            <div
              className={`bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden transform transition-all duration-300 ${isPwdModalVisible ? 'opacity-100 translate-y-0 sm:scale-100' : 'opacity-0 translate-y-full sm:translate-y-4 sm:scale-95'}`}
              ref={pwdModalRef}
              style={{
                overscrollBehaviorY: 'contain',
                ...(pullDownPwdY > 0 ? { transform: `translateY(${pullDownPwdY}px)`, transition: 'none' } : undefined)
              }}
              onTouchStart={(e) => { touchStartRef.current = { y: e.touches[0].clientY, scrollY: 0 } }}
              onTouchEnd={() => { if (pullDownPwdY > 80) { setIsPwdModalVisible(false); setPullDownPwdY(0); setTimeout(() => setConfirmPwdOpen(false), 300) } else setPullDownPwdY(0) }}
              role="dialog" aria-modal="true"
            >
              {/* Drag handle — absolute inside, only mobile */}
              <div className="w-full flex justify-center pt-2 pb-3 sm:hidden absolute top-0 z-20 cursor-pointer" style={{ backgroundColor: 'var(--color-primary)', touchAction: 'none' }} onClick={() => { setIsPwdModalVisible(false); setPullDownPwdY(0); setTimeout(() => setConfirmPwdOpen(false), 300) }}>
                <div className="w-12 h-1.5 rounded-full bg-white/40" />
              </div>
              {/* Header */}
              <div className="px-4 sm:px-6 py-4 flex items-center text-white flex-shrink-0 pt-7 sm:pt-4" style={{ backgroundColor: 'var(--color-primary)', borderTopLeftRadius: 'inherit', borderTopRightRadius: 'inherit', touchAction: 'none' }}>
                <span className="text-base sm:text-lg font-bold tracking-wide">Confirmar cambio de contraseña</span>
                <div className="ml-auto hidden sm:block">
                  <button type="button" onClick={() => { setIsPwdModalVisible(false); setPullDownPwdY(0); setTimeout(() => setConfirmPwdOpen(false), 300) }} aria-label="Cerrar" className="w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors">
                    <span className="material-symbols-outlined text-[22px]">close</span>
                  </button>
                </div>
              </div>
              <div className="p-5">
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-5">¿Confirmas que deseas cambiar tu contraseña? Esta acción no se puede deshacer.</p>
                <div className="flex gap-3 justify-end">
                  <button type="button" onClick={() => { setIsPwdModalVisible(false); setPullDownPwdY(0); setTimeout(() => setConfirmPwdOpen(false), 300) }} className="btn btn-ghost">Cancelar</button>
                  <button type="button" onClick={doChangePassword} className="btn btn-primary">Sí, cambiar</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <Toast visible={toastVisible} message={toastMsg} kind={toastKind} onClose={() => { setToastVisible(false); if (toastTimerRef.current) { try { window.clearTimeout(toastTimerRef.current) } catch (e) {} toastTimerRef.current = null } }} />
      
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
