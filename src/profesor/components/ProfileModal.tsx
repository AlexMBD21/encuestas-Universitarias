import React, { useEffect, useRef, useState } from 'react'
import supabaseClient, { getProfile, upsertProfile, uploadAvatar } from '../../services/supabaseClient'
import { Modal } from '../../components/ui/Modal'
import ButtonLoader from '../../components/ButtonLoader'

export interface ProfileData {
  displayName: string
  avatarUrl: string | null
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

interface Props {
  open: boolean
  onClose: () => void
  userId: string | null
  onSave: (data: ProfileData) => void
}

export default function ProfileModal({ open, onClose, userId, onSave }: Props) {
  const [name, setName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

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
    }
  }, [open, userId])

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
    onClose()
  }

  const initials = name.trim()
    ? name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : ''

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Mi perfil"
      maxWidth="max-w-md"
      noHeaderShadow={true}
      scrollableBody={false}
    >
      <div className="p-6">
        {/* Avatar */}
        <div className="flex flex-col items-center mb-8">
          <div
            className={`relative cursor-pointer group transition-all duration-500 ${isDragging ? 'scale-105' : ''} ${loadingProfile ? 'opacity-50' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => !loadingProfile && fileRef.current?.click()}
            title="Haz clic o arrastra una imagen"
          >
            {/* Anillo de Gradiente Eléctrico Circular */}
            <div className="p-[3.5px] rounded-full bg-gradient-to-tr from-[#06b6d4] via-[#3b82f6] to-[#6366f1] shadow-[0_0_25px_rgba(59,130,246,0.4)] transition-all duration-500 group-hover:shadow-[0_0_45px_rgba(59,130,246,0.6)] group-hover:scale-[1.02]">
              <div className="p-[3px] bg-white dark:bg-slate-900 rounded-full">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 group-hover:border-indigo-400/50 group-hover:bg-indigo-50/10 transition-all relative">
                  {loadingProfile ? (
                    <div className="flex items-center justify-center p-4">
                      <ButtonLoader size={45} outerColor="#0f172a" innerColor="#3b82f6" />
                    </div>
                  ) : avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 rounded-full" />
                  ) : (
                    <div className="flex flex-col items-center justify-center w-full h-full bg-slate-50/50 dark:bg-slate-800/30">
                      <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600 group-hover:text-indigo-400 transition-colors" style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 48" }}>person</span>
                    </div>
                  )}
                  
                  {/* Overlay on hover */}
                  {!loadingProfile && (
                    <div className="absolute inset-0 bg-indigo-600/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Camera Badge */}
            {!loadingProfile && (
              <div className="absolute -right-1 -bottom-1 w-10 h-10 bg-white dark:bg-slate-800 rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.15)] border border-slate-200 dark:border-slate-700 flex items-center justify-center text-indigo-600 dark:text-indigo-400 z-10 transition-all duration-300 group-hover:scale-110">
                <span className="material-symbols-outlined text-[20px] font-bold">photo_camera</span>
              </div>
            )}
            {/* Trash Button (Remove) - Now inside the relative container */}
            {avatarUrl && !loadingProfile && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleRemoveAvatar(); }}
                className="absolute -left-2 -top-2 w-9 h-9 bg-white dark:bg-slate-800 rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.15)] border border-slate-200 dark:border-slate-700 flex items-center justify-center text-red-600 dark:text-red-400 z-30 transition-all hover:scale-110 active:scale-95 hover:bg-red-50 dark:hover:bg-red-900/20"
                title="Quitar foto"
              >
                <span className="material-symbols-outlined text-[20px]">delete</span>
              </button>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f) }}
          />
        </div>

        {/* Name input */}
        <div className="space-y-1.5 mb-8 mt-4">
          <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1" htmlFor="profile-name-input">Nombre completo</label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
              <span className="material-symbols-outlined text-[20px]">person</span>
            </div>
            <input
              id="profile-name-input"
              className="w-full bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-2xl pl-11 pr-4 py-3.5 text-sm font-semibold transition-all outline-none text-slate-700 dark:text-slate-200"
              type="text"
              placeholder="Ej: María García López"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              disabled={saving}
            />
          </div>
          {name.trim() && name.trim().split(/\s+/).length >= 2 && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 ml-1 font-medium">
              Se mostrará como: <strong className="text-slate-700 dark:text-slate-200">{getFirstNameLastName(name)}</strong>
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 dark:border-slate-800">
          <button 
            type="button"
            className={`btn btn-primary ${!name.trim() || saving ? 'opacity-60 cursor-not-allowed shadow-none' : ''}`}
            onClick={handleSave} 
            disabled={!name.trim() || saving}
          >
            {saving ? <><ButtonLoader size={20} /> Guardando...</> : <><span className="material-symbols-outlined text-[20px]">save</span> Guardar perfil</>}
          </button>
        </div>
      </div>
    </Modal>
  )
}

