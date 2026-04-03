import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/dashboard-profesor.css'
import AuthAdapter from '../../services/AuthAdapter'
import supabaseClient from '../../services/supabaseClient'

type CreateSurveyProps = {
  onClose?: () => void
}

type EditSurvey = any

type CreateSurveyPropsFull = {
  onClose?: () => void
  editSurvey?: EditSurvey | null
  onSaved?: (updatedId: any, surveyData?: any) => void
  hideTypeSelector?: boolean
  initialType?: 'simple'|'project'
}

export default function CreateSurvey({ onClose, editSurvey, onSaved, hideTypeSelector, initialType }: CreateSurveyPropsFull): JSX.Element {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [surveyType, setSurveyType] = useState<'simple' | 'project'>(initialType ?? 'simple')
  type Question = { id: number; text: string; type: 'text' | 'multiple'; options?: string[] }
  const [questions, setQuestions] = useState<Question[]>([{ id: Date.now(), text: '', type: 'text', options: [] }])
  type Project = { id: string; name: string; category?: string; description?: string; members?: string; advisor?: string }
  const [projects, setProjects] = useState<Project[]>([])
  type RubricQ = { id: string; text: string; kind: 'score' | 'text' }
  const [rubric, setRubric] = useState<RubricQ[]>([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const navigate = useNavigate()
  const [currentUser, setCurrentUser] = useState<any | null>(() => AuthAdapter.getUser())
  const currentUserId = currentUser ? (currentUser.email || (currentUser.id as any) || null) : null
  const supabaseEnabledNow = (supabaseClient && (supabaseClient as any).isEnabled && (supabaseClient as any).isEnabled())
  const dataClientNow: any = supabaseClient

  React.useEffect(() => {
    const onAuth = () => { try { setCurrentUser(AuthAdapter.getUser()) } catch (e) {} }
    try { window.addEventListener('auth:changed', onAuth as EventListener) } catch (e) {}
    return () => { try { window.removeEventListener('auth:changed', onAuth as EventListener) } catch (e) {} }
  }, [])

  // initialize when editing
  React.useEffect(() => {
    if (!editSurvey) return
    try {
      setTitle(editSurvey.title || '')
      setDescription(editSurvey.description || '')
      setSurveyType(editSurvey.type === 'project' ? 'project' : 'simple')
      if (editSurvey.type === 'simple') {
        setQuestions((editSurvey.questions || []).map((q: any) => ({ id: Date.now() + Math.random(), text: q.text || '', type: q.type || 'text', options: q.options ? [...q.options] : [] })))
      } else {
        setProjects((editSurvey.projects || []).map((p: any) => ({ id: p.id || String(Date.now() + Math.random()), name: p.name || '', category: p.category || '', description: p.description || '', members: Array.isArray(p.members) ? (p.members || []).join(', ') : (p.members || ''), advisor: p.advisor || '' })))
        setRubric((editSurvey.rubric || []).map((r: any) => ({ id: r.id || String(Date.now() + Math.random()), text: r.text || '', kind: r.kind || 'score' })))
      }
    } catch (e) {}
  }, [editSurvey])

  const addQuestion = (type: 'text' | 'multiple' = 'text') => setQuestions(q => [...q, { id: Date.now() + Math.random(), text: '', type, options: type === 'multiple' ? [''] : [] }])
  const removeQuestion = (id: number) => setQuestions(q => q.filter(s => s.id !== id))
  const setQuestionText = (id: number, val: string) => setQuestions(q => q.map(s => s.id === id ? { ...s, text: val } : s))
  const setQuestionType = (id: number, type: 'text' | 'multiple') => setQuestions(q => q.map(s => s.id === id ? { ...s, type, options: type === 'multiple' ? (s.options && s.options.length ? s.options : ['']) : [] } : s))
  const addOption = (qid: number) => setQuestions(q => q.map(s => s.id === qid ? { ...s, options: [...(s.options || []), ''] } : s))
  const setOption = (qid: number, idx: number, val: string) => setQuestions(q => q.map(s => s.id === qid ? { ...s, options: s.options?.map((o, i) => i === idx ? val : o) } : s))
  const removeOption = (qid: number, idx: number) => setQuestions(q => q.map(s => s.id === qid ? { ...s, options: s.options?.filter((_, i) => i !== idx) } : s))

  const onCancel = () => {
    if (onClose) return onClose()
    try { navigate('/profesor/encuestas') } catch (e) { window.history.pushState(null, '', '/profesor/encuestas') }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setMessage('Ingrese un título para la encuesta')
      return
    }
    if (surveyType === 'simple') {
      if (questions.length === 0 || questions.every(q => !q.text.trim())) {
        setMessage('Agregue al menos una pregunta')
        return
      }
    } else {
      if (projects.length === 0) {
        setMessage('Agregue al menos un proyecto')
        return
      }
      if (rubric.length === 0) {
        setMessage('Defina la rúbrica (criterios)')
        return
      }
    }
    setMessage('')
    setSaving(true)
    // persist: use Supabase backend (no local fallback)
    try {
      const now = new Date().toISOString()
      if (editSurvey && editSurvey.id) {
        // update existing
        const updated: any = { ...editSurvey, title: title.trim(), description: description.trim(), type: surveyType }
        if (surveyType === 'simple') {
          updated.questions = questions.map(q => ({ text: q.text.trim(), type: q.type, options: q.options?.map(o => o.trim()).filter(Boolean) }))
          delete updated.projects
          delete updated.rubric
        } else {
          // normalize members to array before saving
          updated.projects = projects.map(p => ({ id: p.id || (Date.now() + Math.random()), name: p.name, category: p.category, description: p.description, members: typeof p.members === 'string' ? p.members.split(/[;,]/).map((s: string) => s.trim()).filter(Boolean) : (Array.isArray(p.members) ? p.members : []), advisor: p.advisor || '' }))
          updated.rubric = rubric.map(r => ({ id: r.id, text: r.text, kind: r.kind }))
          delete updated.questions
        }

        if ((dataClientNow as any).isEnabled && (dataClientNow as any).isEnabled()) {
          try {
            await dataClientNow.setSurvey(String(editSurvey.id), updated)
            setSaving(false)
            setMessage('Encuesta actualizada correctamente')
            try { window.dispatchEvent(new CustomEvent('surveys:updated', { detail: { newId: editSurvey.id, survey: updated } })) } catch (e) {}
            if (onSaved) onSaved(editSurvey.id, updated)
            setTimeout(() => { if (onClose) onClose() }, 700)
            return
          } catch (fbErr: any) {
            console.error('firebase setSurvey error', fbErr)
            setSaving(false)
            if (fbErr && fbErr.code && (fbErr.code === 'permission-denied' || fbErr.code === 'PERMISSION_DENIED')) {
              setMessage('No tiene permiso para editar esta encuesta')
              return
            }
            setMessage('Error guardando encuesta (Supabase)')
            return
          }
        }
        // If Supabase is not enabled, prevent local fallback — require DB
        setSaving(false)
        setMessage('Supabase no está habilitado: no es posible actualizar la encuesta en este modo')
        return
      }

      // create new survey
      const newSurvey: any = { id: `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`, title: title.trim(), description: description.trim(), createdAt: now, type: surveyType }
      newSurvey.ownerId = currentUserId || 'local'
      if (surveyType === 'simple') {
        newSurvey.questions = questions.map(q => ({ text: q.text.trim(), type: q.type, options: q.options?.map(o => o.trim()).filter(Boolean) }))
      } else {
        newSurvey.projects = projects.map(p => ({ id: p.id || (Date.now() + Math.random()), name: p.name, category: p.category, description: p.description, members: typeof p.members === 'string' ? p.members.split(/[;,]/).map((s: string) => s.trim()).filter(Boolean) : (Array.isArray(p.members) ? p.members : []), advisor: p.advisor || '' }))
        newSurvey.rubric = rubric.map(r => ({ id: r.id, text: r.text, kind: r.kind }))
      }

      if ((dataClientNow as any).isEnabled && (dataClientNow as any).isEnabled()) {
        try {
          const key = await dataClientNow.pushSurvey(newSurvey)
          // successful push to Supabase
          
          
          
          
          
          
          
          
          // notify and update UI — include full survey so listeners can do an optimistic insert
          const savedSurvey = { ...newSurvey, id: key, published: false }
          try { window.dispatchEvent(new CustomEvent('surveys:updated', { detail: { newId: key, survey: savedSurvey } })) } catch (e) {}
          setSaving(false)
          setMessage('Encuesta creada correctamente')
          if (onSaved) onSaved(key, savedSurvey)
          setTimeout(() => {
            if (onClose) return onClose()
            try { navigate('/profesor/encuestas') } catch (e) { window.history.pushState(null, '', '/profesor/encuestas') }
          }, 300)
          return
        } catch (fbErr: any) {
          console.error('firebase pushSurvey error', fbErr)
          setSaving(false)
          if (fbErr && fbErr.code && (fbErr.code === 'permission-denied' || fbErr.code === 'PERMISSION_DENIED')) {
            setMessage('No tiene permiso para crear encuestas')
            return
          }
          setMessage('Error creando encuesta (Supabase)')
          return
        }
      }
      // If Supabase not enabled, fail explicitly (do not use localStorage fallback)
      setSaving(false)
      setMessage('Supabase no está habilitado: no es posible crear encuestas en este modo')
    } catch (err) {
      setSaving(false)
      setMessage('Error guardando encuesta')
    }
  }

  return (
    <div className="create-survey bg-white dark:bg-slate-900 rounded-xl border p-6 shadow mb-6">

      {/* Breadcrumb — solo visible cuando no hay onClose (es página completa) */}
      {!onClose && (
        <nav className="page-breadcrumb" aria-label="Ruta de navegación">
          <button className="page-breadcrumb-link" onClick={() => navigate('/profesor/encuestas')}>
            <span className="material-symbols-outlined">assignment</span>
            Encuestas
          </button>
          <span className="material-symbols-outlined page-breadcrumb-sep">chevron_right</span>
          <span className="page-breadcrumb-current">{editSurvey ? 'Editar encuesta' : 'Nueva encuesta'}</span>
        </nav>
      )}

      <form onSubmit={onSubmit}>
        {!hideTypeSelector && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Tipo</label>
            <select value={surveyType} onChange={e => setSurveyType(e.target.value as any)} className="p-2 border rounded">
              <option value="simple">Encuesta simple</option>
              <option value="project">Encuesta de proyectos (rúbrica)</option>
            </select>
          </div>
        )}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Título</label>
          <input className="w-full p-2 border rounded" value={title} onChange={e => setTitle(e.target.value)} placeholder="Título de la encuesta" />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Descripción</label>
          <textarea className="w-full p-2 border rounded" value={description} onChange={e => setDescription(e.target.value)} placeholder="Descripción (opcional)" />
        </div>

        {surveyType === 'simple' ? (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Preguntas</label>
            <div className="space-y-4">
              {questions.map((q, i) => (
                <div key={q.id} className="p-3 border rounded question-card">
                  <div className="flex items-center justify-between mb-2 question-header">
                    <strong>Pregunta {i + 1}</strong>
                    <div className="flex items-center gap-2 question-controls">
                      <select value={q.type} onChange={e => setQuestionType(q.id, e.target.value as any)} className="p-1 border rounded">
                        <option value="text">Texto</option>
                        <option value="multiple">Opción múltiple</option>
                      </select>
                      <button type="button" onClick={() => removeQuestion(q.id)} className="px-2 py-1 bg-red-500 text-white rounded">Eliminar</button>
                    </div>
                  </div>
                  <input className="w-full p-2 border rounded mb-2" value={q.text} onChange={e => setQuestionText(q.id, e.target.value)} placeholder={`Pregunta ${i + 1}`} />
                  {q.type === 'multiple' && (
                    <div className="space-y-2">
                      {(q.options || []).map((opt, oi) => (
                        <div key={oi} className="flex gap-2 items-center">
                          <input className="flex-1 p-2 border rounded" value={opt} onChange={e => setOption(q.id, oi, e.target.value)} placeholder={`Opción ${oi + 1}`} />
                          <button type="button" className="px-3 py-1 bg-red-500 text-white rounded" onClick={() => removeOption(q.id, oi)}>Eliminar</button>
                        </div>
                      ))}
                      <div>
                        <button type="button" onClick={() => addOption(q.id)} className="px-3 py-1 bg-gray-200 rounded">Añadir opción</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <button type="button" className="px-3 py-2 bg-gray-200 rounded" onClick={() => addQuestion('text')}>Añadir pregunta de texto</button>
              <button type="button" className="px-3 py-2 bg-gray-200 rounded" onClick={() => addQuestion('multiple')}>Añadir pregunta de opción múltiple</button>
            </div>
          </div>
        ) : (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Proyectos</label>
            <div className="space-y-3">
              {projects.map((p, i) => (
                <div key={p.id} className="p-3 border rounded">
                  <div className="flex justify-between items-center mb-2">
                    <strong>{p.name || `Proyecto ${i+1}`}</strong>
                    <button type="button" onClick={() => setProjects(prev => prev.filter(x => x.id !== p.id))} className="px-2 py-1 bg-red-500 text-white rounded">Eliminar</button>
                  </div>
                  <input className="w-full p-2 border rounded mb-2" placeholder="Nombre del proyecto" value={p.name} onChange={e => setProjects(prev => prev.map(x => x.id === p.id ? { ...x, name: e.target.value } : x))} />
                  <input className="w-full p-2 border rounded mb-2" placeholder="Categoría" value={p.category} onChange={e => setProjects(prev => prev.map(x => x.id === p.id ? { ...x, category: e.target.value } : x))} />
                  <input className="w-full p-2 border rounded mb-2" placeholder="Integrantes (separados por comas)" value={p.members || ''} onChange={e => setProjects(prev => prev.map(x => x.id === p.id ? { ...x, members: e.target.value } : x))} />
                  <input className="w-full p-2 border rounded mb-2" placeholder="Profesor asesor" value={p.advisor || ''} onChange={e => setProjects(prev => prev.map(x => x.id === p.id ? { ...x, advisor: e.target.value } : x))} />
                  <textarea className="w-full p-2 border rounded" placeholder="Descripción (opcional)" value={p.description} onChange={e => setProjects(prev => prev.map(x => x.id === p.id ? { ...x, description: e.target.value } : x))} />
                </div>
              ))}
            </div>
              <div className="mt-2">
              <button type="button" onClick={() => setProjects(prev => [...prev, { id: String(Date.now() + Math.random()), name: '', category: '', members: '', advisor: '', description: '' }])} className="px-3 py-2 bg-gray-200 rounded">Añadir proyecto</button>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium mb-2">Rúbrica (criterios)</label>
              <div className="space-y-3">
                {rubric.map((r, i) => (
                  <div key={r.id} className="p-3 border rounded">
                    <div className="flex items-center justify-between mb-2">
                      <strong>Criterio {i+1}</strong>
                      <button type="button" onClick={() => setRubric(prev => prev.filter(x => x.id !== r.id))} className="px-2 py-1 bg-red-500 text-white rounded">Eliminar</button>
                    </div>
                    <input className="w-full p-2 border rounded mb-2" placeholder="Texto del criterio" value={r.text} onChange={e => setRubric(prev => prev.map(x => x.id === r.id ? { ...x, text: e.target.value } : x))} />
                    <select value={r.kind} onChange={e => setRubric(prev => prev.map(x => x.id === r.id ? { ...x, kind: e.target.value as any } : x))} className="p-2 border rounded">
                      <option value="score">Puntuación (1-5)</option>
                      <option value="text">Comentario</option>
                    </select>
                  </div>
                ))}
              </div>
              <div className="mt-2">
                <button type="button" onClick={() => setRubric(prev => [...prev, { id: String(Date.now() + Math.random()), text: '', kind: 'score' }])} className="px-3 py-2 bg-gray-200 rounded">Añadir criterio</button>
              </div>
            </div>
          </div>
        )}

        {message && <div className={`message ${message.includes('correcta') ? 'success' : 'error'} show`} role="status">{message}</div>}

        <div className="mt-4 flex gap-2">
          <button type="submit" disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded">{saving ? 'Guardando...' : (editSurvey ? 'Editar encuesta' : 'Crear encuesta')}</button>
          <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-200 rounded">Cancelar</button>
        </div>
      </form>
    </div>
  )
}
