import React, { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import supabaseClient, { getProfile, upsertProfile, uploadAvatar } from '../../services/supabaseClient'

export interface ProfileData {
  displayName: string
  avatarUrl: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  userId: string | null
  onSave: (data: ProfileData) => void
}

const LOCAL_KEY = (userId: string | null) => `profile:${userId || 'guest'}`

/** Carga el perfil desde Supabase con fallback a localStorage */
export async function loadProfileAsync(userId: string | null): Promise<ProfileData> {
  if (userId && supabaseClient.isEnabled()) {
    try {
      const p = await getProfile(userId)
      if (p) {
        // sync to localStorage as cache
        try { localStorage.setItem(LOCAL_KEY(userId), JSON.stringify({ displayName: p.display_name, avatarUrl: p.avatar_url || null })) } catch (e) {}
        return { displayName: p.display_name || '', avatarUrl: p.avatar_url || null }
      }
    } catch (e) {}
  }
  // localStorage fallback
  try {
    const raw = localStorage.getItem(LOCAL_KEY(userId))
    if (raw) return JSON.parse(raw)
  } catch (e) {}
  return { displayName: '', avatarUrl: null }
}

/** Carga síncrona desde cache localStorage (para render inicial sin parpadeo) */
export function loadProfile(userId: string | null): ProfileData {
  try {
    const raw = localStorage.getItem(LOCAL_KEY(userId))
    if (raw) return JSON.parse(raw)
  } catch (e) {}
  return { displayName: '', avatarUrl: null }
}

function getFirstNameLastName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 0 || !parts[0]) return ''
  return parts.length >= 2 ? `${parts[0]} ${parts[1]}` : parts[0]
}

export default function ProfileModal({ open, onClose, userId, onSave }: Props) {
  const [name, setName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [visible, setVisible] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const closingRef = useRef<number | null>(null)

  // Load profile from Supabase when opening
  useEffect(() => {
    if (open) {
      setLoadingProfile(true)
      loadProfileAsync(userId).then(p => {
        setName(p.displayName)
        setAvatarUrl(p.avatarUrl)
        setLoadingProfile(false)
      })
      setPendingFile(null)
      requestAnimationFrame(() => { requestAnimationFrame(() => setVisible(true)) })
    } else {
      setVisible(false)
    }
    return () => { if (closingRef.current) clearTimeout(closingRef.current) }
  }, [open, userId])

  const handleClose = () => {
    if (saving) return
    setVisible(false)
    closingRef.current = window.setTimeout(() => onClose(), 240)
  }

  const handleImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) return
    setPendingFile(file)
    const reader = new FileReader()
    reader.onload = (e) => { setAvatarUrl(e.target?.result as string) }
    reader.readAsDataURL(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleImageFile(file)
  }

  const handleRemoveAvatar = () => {
    setAvatarUrl(null)
    setPendingFile(null)
  }

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    const shortName = getFirstNameLastName(name)
    let finalUrl = avatarUrl

    // Upload new photo to Supabase Storage if a new file was selected
    if (pendingFile && userId && supabaseClient.isEnabled()) {
      const uploaded = await uploadAvatar(userId, pendingFile)
      if (uploaded) finalUrl = uploaded
    }

    // Save profile to Supabase table
    if (userId && supabaseClient.isEnabled()) {
      await upsertProfile(userId, shortName, finalUrl || '')
    }

    // Always keep localStorage cache in sync
    const data: ProfileData = { displayName: shortName, avatarUrl: finalUrl }
    try { localStorage.setItem(LOCAL_KEY(userId), JSON.stringify(data)) } catch (e) {}

    setSaving(false)
    onSave(data)
    handleClose()
  }

  const initials = name.trim()
    ? name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : ''

  if (!open) return null

  return ReactDOM.createPortal(
    <div
      className={`profile-modal-overlay${visible ? ' visible' : ''}`}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div className={`profile-modal${visible ? ' visible' : ''}`} role="dialog" aria-modal="true" aria-label="Editar perfil">

        {/* Header */}
        <div className="profile-modal-header">
          <h2 className="profile-modal-title">Mi perfil</h2>
          <button className="profile-modal-close" onClick={handleClose} aria-label="Cerrar" disabled={saving}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Avatar */}
        <div className="profile-avatar-section">
          <div
            className={`profile-avatar-drop${isDragging ? ' dragging' : ''}${loadingProfile ? ' loading' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => !loadingProfile && fileRef.current?.click()}
            title="Haz clic o arrastra una imagen"
          >
            {loadingProfile ? (
              <span className="material-symbols-outlined profile-avatar-loading">progress_activity</span>
            ) : avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="profile-avatar-img" />
            ) : (
              initials
                ? <span className="profile-avatar-initials">{initials}</span>
                : <span className="material-symbols-outlined profile-avatar-default">account_circle</span>
            )}
            {!loadingProfile && (
              <div className="profile-avatar-overlay">
                <span className="material-symbols-outlined">photo_camera</span>
              </div>
            )}
          </div>
          <p className="profile-avatar-hint">Haz clic o arrastra una foto</p>
          {avatarUrl && !loadingProfile && (
            <button className="profile-remove-avatar" onClick={handleRemoveAvatar}>
              Eliminar foto
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f) }}
          />
        </div>

        {/* Name input */}
        <div className="profile-field">
          <label className="profile-field-label" htmlFor="profile-name-input">Nombre completo</label>
          <input
            id="profile-name-input"
            className="profile-field-input"
            type="text"
            placeholder="Ej: María García López"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            disabled={saving}
          />
          {name.trim() && name.trim().split(/\s+/).length >= 2 && (
            <p className="profile-field-hint">
              Se mostrará como: <strong>{getFirstNameLastName(name)}</strong>
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="profile-modal-actions">
          <button className="profile-btn-cancel" onClick={handleClose} disabled={saving}>Cancelar</button>
          <button className="profile-btn-save" onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

