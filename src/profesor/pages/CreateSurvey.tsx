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
  
  const [allowedCategories, setAllowedCategories] = useState<string[]>([])
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

  const [globalAsignaturas, setGlobalAsignaturas] = useState<string[]>([])
  
  React.useEffect(() => {
    const loadGlobals = async () => {
      try {
        if (dataClientNow.getSurveyById) {
          const sys = await dataClientNow.getSurveyById('sys_settings_project_categories')
          if (sys && Array.isArray(sys.rubric) && sys.rubric.length > 0) {
            setGlobalAsignaturas(sys.rubric)
          } else {
             setGlobalAsignaturas(["Matemáticas", "Ingeniería de Software", "Finanzas", "Tecnología", "Salud", "Ciencias Básicas", "Ciencias Sociales", "Negocios"])
          }
        }
      } catch(e){}
    }
    loadGlobals()
  }, [dataClientNow])

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
        setAllowedCategories(editSurvey.allowedCategories || editSurvey.allowed_categories || [])
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
          updated.allowed_categories = allowedCategories.map(c => c.trim()).filter(Boolean)
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
        newSurvey.allowed_categories = allowedCategories.map(c => c.trim()).filter(Boolean)
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

  const isModal = !!onClose;

  return (
    <div className={`create-survey ${isModal ? 'px-4 pb-8 pt-5 sm:pt-4 sm:px-2' : 'bg-white dark:bg-slate-900 sm:rounded-3xl border-y sm:border border-slate-200 dark:border-slate-800 p-4 sm:p-6 md:p-8 shadow-xl shadow-slate-200/40 dark:shadow-none mb-0 sm:mb-8'} animate-in fade-in duration-300 w-full`}>
      {/* Breadcrumb — solo visible cuando no hay onClose (es página completa) */}
      {!onClose && (
        <nav className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 mb-8 pb-4 border-b border-slate-100 dark:border-slate-800" aria-label="Ruta de navegación">
          <button className="flex items-center gap-1.5 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" onClick={() => navigate('/profesor/encuestas')}>
            <span className="material-symbols-outlined text-[18px]">assignment</span>
            Encuestas
          </button>
          <span className="material-symbols-outlined text-[16px] text-slate-300 dark:text-slate-600">chevron_right</span>
          <span className="text-slate-800 dark:text-slate-200 font-bold">{editSurvey ? 'Editar encuesta' : 'Nueva encuesta'}</span>
        </nav>
      )}

      <form onSubmit={onSubmit}>
        {!hideTypeSelector && (
          <div className="mb-6">
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Formato de la Encuesta</label>
            <div className="relative">
              <select value={surveyType} onChange={e => setSurveyType(e.target.value as any)} className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-800 font-medium rounded-xl pl-4 pr-10 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 transition-shadow">
                <option value="simple">Encuesta Simple (Preguntas y opciones)</option>
                <option value="project">Proyecto Avanzado (Rúbricas y equipos)</option>
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 flex items-center text-slate-400">
                <span className="material-symbols-outlined text-[20px] select-none">expand_more</span>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6">
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Título de la campaña</label>
          <input className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-lg font-semibold rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 transition-shadow placeholder:text-slate-400 placeholder:font-normal" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej. Encuesta de Satisfacción 2026" />
        </div>

        <div className="mb-8">
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Descripción (Opcional)</label>
          <textarea className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-base rounded-xl px-4 py-3 min-h-[100px] focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 transition-shadow placeholder:text-slate-400" value={description} onChange={e => setDescription(e.target.value)} placeholder="Agrega instrucciones útiles o propósito de esta recolección de datos..." />
        </div>

        {surveyType === 'simple' ? (
          <div className="mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 mt-6">
               <label className="block text-xl font-bold text-slate-800 dark:text-slate-100">Batería de Preguntas</label>
               <div className="flex flex-col xs:flex-row gap-2 w-full sm:w-auto">
                 <button type="button" className="flex justify-center items-center gap-1.5 px-4 py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:border-slate-300 text-slate-700 text-sm font-semibold rounded-lg dark:bg-slate-800/50 dark:border-slate-700 dark:hover:bg-slate-800 dark:text-slate-300 transition-colors w-full sm:w-auto" onClick={() => addQuestion('text')}>
                   <span className="material-symbols-outlined text-[18px]">short_text</span> Texto
                 </button>
                 <button type="button" className="flex justify-center items-center gap-1.5 px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 text-sm font-semibold rounded-lg dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800 dark:hover:bg-blue-900/60 transition-colors w-full sm:w-auto" onClick={() => addQuestion('multiple')}>
                   <span className="material-symbols-outlined text-[18px]">checklist</span> Opción Única/Múltiple
                 </button>
               </div>
            </div>
            
            <div className="space-y-6">
              {questions.map((q, i) => (
                <div key={q.id} className="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                  <div className="p-4 pl-4 sm:pl-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex-1 min-w-0 w-full">
                        <input className="w-full bg-transparent border-b border-slate-200 dark:border-slate-700 sm:border-transparent hover:border-slate-300 focus:border-blue-500 text-slate-800 text-base sm:text-sm font-medium px-2 py-2 sm:py-1.5 outline-none dark:text-slate-100 transition-all placeholder:text-slate-400" value={q.text} onChange={e => setQuestionText(q.id, e.target.value)} placeholder={`Pregunta ${i + 1}`} />
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto shrink-0 mt-2 sm:mt-0">
                        <div className="relative bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex-1 sm:flex-none">
                          <select value={q.type} onChange={e => setQuestionType(q.id, e.target.value as any)} className="w-full appearance-none bg-transparent pl-3 pr-10 py-2 sm:py-1.5 text-sm sm:text-xs font-semibold text-slate-600 dark:text-slate-300 outline-none cursor-pointer">
                            <option value="text">Texto Libre</option>
                            <option value="multiple">Opción Múltiple</option>
                          </select>
                          <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[16px] select-none">expand_more</span>
                        </div>
                        <button type="button" onClick={() => removeQuestion(q.id)} className="text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 p-2 sm:p-1.5 rounded-lg transition-colors flex shrink-0" title="Eliminar pregunta">
                          <span className="material-symbols-outlined text-[20px] sm:text-[18px]">delete</span>
                        </button>
                      </div>
                    </div>

                    {q.type === 'multiple' && (
                      <div className="mt-3 ml-2 space-y-1.5 border-t border-slate-100 dark:border-slate-800 pt-3">
                        {(q.options || []).map((opt, oi) => (
                          <div key={oi} className="flex items-center gap-2 group/opt">
                            <span className="material-symbols-outlined text-[18px] text-slate-300 dark:text-slate-600 shrink-0">radio_button_unchecked</span>
                            <input className="flex-1 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 text-slate-700 dark:text-slate-300 text-sm py-1 outline-none transition-colors placeholder:text-slate-400" value={opt} onChange={e => setOption(q.id, oi, e.target.value)} placeholder={`Opción ${oi + 1}`} />
                            <button type="button" className="text-slate-300 hover:text-red-500 transition-colors p-0.5 shrink-0" onClick={() => removeOption(q.id, oi)} title="Remover opción">
                              <span className="material-symbols-outlined text-[16px]">close</span>
                            </button>
                          </div>
                        ))}
                        <button type="button" onClick={() => addOption(q.id)} className="mt-1 text-xs font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 flex items-center gap-1 pl-7">
                          <span className="material-symbols-outlined text-[14px]">add</span> Añadir opción
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {questions.length === 0 && (
              <div className="py-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center text-center">
                 <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 mb-3">quiz</span>
                 <h4 className="text-slate-600 dark:text-slate-400 font-medium mb-4">No hay preguntas agregadas</h4>
                 <div className="flex flex-col sm:flex-row gap-3 w-full max-w-[280px] sm:max-w-none px-4 sm:px-0 mx-auto sm:mx-0 justify-center">
                   <button type="button" className="w-full sm:w-auto px-4 py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:border-slate-300 text-slate-700 text-sm font-semibold rounded-lg dark:bg-slate-800/50 dark:border-slate-700 dark:hover:bg-slate-800 dark:text-slate-300 transition-colors flex items-center justify-center gap-1.5" onClick={() => addQuestion('text')}>
                     <span className="material-symbols-outlined text-[18px]">short_text</span> Pregunta Texto
                   </button>
                   <button type="button" className="w-full sm:w-auto px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-sm font-semibold rounded-lg dark:bg-blue-900/40 transition-colors flex items-center justify-center gap-1.5" onClick={() => addQuestion('multiple')}>
                     <span className="material-symbols-outlined text-[18px]">checklist</span> Pregunta Opciones
                   </button>
                 </div>
              </div>
            )}
          </div>
        ) : (
          <div className="mb-4">

            <div className="mt-8 border-b border-slate-100 dark:border-slate-800 pb-4 mb-6">
               <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-start sm:items-center gap-2">
                 <span className="material-symbols-outlined text-indigo-500 mt-0.5 sm:mt-0 text-[24px]">groups</span> Equipos / Proyectos a Evaluar (Opcional)
               </h3>
               <p className="text-sm text-slate-500 mt-1 pl-8 sm:pl-0 pt-2 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                 <b>Nota:</b> Puedes dejar esta sección completamente vacía al guardar. Una vez creada la encuesta, podrás generar un Enlace Mágico que se compartirá enviando directamente a cada estudiante. A través de este link temporal de 24 horas, ellos mismos subirán sus datos, llenarán esta lista y asignarán sus proyectos a tu asignatura de forma automática.
               </p>
            </div>
            
            <div className="flex flex-col gap-4">
              {projects.map((p, i) => (
                <div key={p.id} className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow group overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-indigo-400"></div>
                  <div className="flex justify-between items-center mb-5">
                    <span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg text-xs font-bold dark:bg-indigo-900/30 dark:text-indigo-400 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px]">folder</span> Proyecto #{i + 1}
                    </span>
                    <button type="button" onClick={() => setProjects(prev => prev.filter(x => x.id !== p.id))} className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors px-2.5 py-1 rounded-lg" title="Remover proyecto">
                      <span className="material-symbols-outlined text-[16px]">delete</span> Eliminar
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    {/* Nombre */}
                    <div className="md:col-span-2">
                      <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Nombre del Proyecto</label>
                      <input className="w-full mt-1 bg-slate-50 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm font-semibold rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent placeholder:text-slate-400 placeholder:font-normal transition-shadow" placeholder="Ej. Equipo Alfa — App de Gestón" value={p.name} onChange={e => setProjects(prev => prev.map(x => x.id === p.id ? { ...x, name: e.target.value } : x))} />
                    </div>
                    {/* Descripción */}
                    <div className="md:col-span-2">
                      <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Descripción del proyecto</label>
                      <textarea
                      placeholder="Breve descripción del proyecto..."
                      rows={2}
                      className="w-full mt-1 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-400/20 rounded-xl text-sm p-3 text-slate-700 dark:text-slate-200 outline-none transition-all placeholder:text-slate-400 resize-y"
                      value={p.description || ''}
                      onChange={e => setProjects(prev => prev.map(x => x.id === p.id ? { ...x, description: e.target.value } : x))}
                    /></div>
                    {/* Categoría */}
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Categoría</label>
                      <select className="w-full mt-1 bg-slate-50 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-shadow cursor-pointer" value={p.category || ''} onChange={e => setProjects(prev => prev.map(x => x.id === p.id ? { ...x, category: e.target.value } : x))}>
                         <option value="">(Selecciona una categoría)</option>
                         {p.category && !globalAsignaturas.includes(p.category) && (
                           <option key={`missing-${p.category}`} value={p.category}>{p.category}</option>
                         )}
                         {globalAsignaturas.filter(x => x.trim()).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    {/* Asesor */}
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Profesor Asesor</label>
                      <input className="w-full mt-1 bg-slate-50 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent placeholder:text-slate-400 transition-shadow" placeholder="Nombre del asesor" value={p.advisor || ''} onChange={e => setProjects(prev => prev.map(x => x.id === p.id ? { ...x, advisor: e.target.value } : x))} />
                    </div>
                    {/* Integrantes */}
                    <div className="md:col-span-2">
                      <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Integrantes del equipo</label>
                      <textarea
                      placeholder="Nombres de los integrantes..."
                      rows={2}
                      className="w-full mt-1 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-400/20 rounded-xl text-sm p-3 text-slate-700 dark:text-slate-200 outline-none transition-all placeholder:text-slate-400 resize-y"
                      value={p.members}
                      onChange={e => setProjects(prev => prev.map(x => x.id === p.id ? { ...x, members: e.target.value } : x))}
                    /></div>
                  </div>
                </div>
              ))}
              
              <button type="button" onClick={() => setProjects(prev => [...prev, { id: String(Date.now() + Math.random()), name: '', category: '', members: '', advisor: '', description: '' }])} className="w-full border-2 border-dashed border-indigo-200 dark:border-indigo-800/50 rounded-2xl flex items-center justify-center gap-2 py-4 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors font-semibold text-sm">
                 <span className="material-symbols-outlined text-[20px]">add_circle</span> Añadir otro Proyecto
              </button>
            </div>

            <div className="mt-8 mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl flex items-start gap-3">
              <span className="material-symbols-outlined text-amber-500 shrink-0 text-[22px] mt-0.5">category</span>
              <div>
                <p className="text-sm font-bold text-amber-800 dark:text-amber-300">Categorías de proyectos</p>
                <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-0.5">Una vez creada la encuesta, podrás gestionar la lista de categorías desde el botón <span className="font-bold">Categorías</span> ubicado en la sección de filtros de la página principal.</p>
              </div>
            </div>

            <div className="mt-12 border-b border-slate-100 dark:border-slate-800 pb-4 mb-6">
               <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-start sm:items-center gap-2">
                 <span className="material-symbols-outlined text-emerald-500 mt-0.5 sm:mt-0 text-[24px]">grading</span> Criterios de Evaluación (Rúbrica)
               </h3>
               <p className="text-sm text-slate-500 mt-1 pl-8 sm:pl-0">Define las reglas con las que se calificará a TODOS los proyectos matriculados arriba.</p>
            </div>

            <div className="space-y-2 bg-slate-50 dark:bg-slate-800/30 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
              {rubric.map((r, i) => (
                <div key={r.id} className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-2 p-3 sm:p-2 rounded-xl bg-white sm:bg-transparent dark:bg-slate-900/50 sm:dark:bg-transparent shadow-sm sm:shadow-none border border-slate-100 dark:border-slate-800 sm:border-transparent sm:hover:bg-white dark:sm:hover:bg-slate-800 transition-colors min-w-0 overflow-hidden mb-2 sm:mb-0">
                  <div className="flex items-center gap-2 flex-1 w-full min-w-0">
                    <span className="w-6 h-6 flex items-center justify-center bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 rounded-full text-xs font-bold shrink-0">{i+1}</span>
                    <input
                      className="min-w-0 flex-1 w-full bg-transparent border-b border-slate-200 dark:border-slate-700 sm:border-transparent hover:border-slate-300 focus:border-emerald-500 text-slate-800 dark:text-slate-100 font-medium px-2 py-2 sm:py-1 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal text-base sm:text-sm truncate"
                      placeholder="Ej. Presentación y Respeto..."
                      value={r.text}
                      onChange={e => setRubric(prev => prev.map(x => x.id === r.id ? { ...x, text: e.target.value } : x))}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto mt-1 sm:mt-0 pl-8 sm:pl-0">
                    <div className="relative shrink-0 flex-1 sm:flex-none">
                      <select
                        value={r.kind}
                        onChange={e => setRubric(prev => prev.map(x => x.id === r.id ? { ...x, kind: e.target.value as any } : x))}
                        className="w-full appearance-none bg-slate-50 sm:bg-white dark:bg-slate-800/80 sm:dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg pl-3 pr-8 py-2.5 sm:py-1.5 text-sm sm:text-xs font-semibold text-slate-600 dark:text-slate-300 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-sm"
                      >
                        <option value="score">Calificación (1 a 5)</option>
                        <option value="text">Comentario Libre</option>
                      </select>
                      <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[16px] select-none">expand_more</span>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => setRubric(prev => prev.filter(x => x.id !== r.id))}
                      className="shrink-0 w-10 h-10 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg sm:rounded-full bg-red-50 text-red-500 sm:text-red-400 sm:bg-transparent sm:hover:text-red-600 sm:hover:bg-red-50 dark:bg-red-900/30 sm:dark:bg-transparent dark:sm:hover:bg-red-900/30 transition-colors border border-red-100 sm:border-transparent dark:border-red-900/50"
                      title="Eliminar criterio"
                    >
                      <span className="material-symbols-outlined text-[20px] sm:text-[18px]">delete</span>
                    </button>
                  </div>
                </div>
              ))}
              
              <div className="pt-3">
                <button type="button" onClick={() => setRubric(prev => [...prev, { id: String(Date.now() + Math.random()), text: '', kind: 'score' }])} className="w-full sm:w-auto justify-center text-sm font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 px-4 py-3 sm:py-2 bg-emerald-50 sm:bg-transparent rounded-xl sm:rounded-lg border border-emerald-100 sm:border-transparent hover:bg-emerald-100 sm:hover:bg-emerald-50 dark:bg-emerald-900/20 sm:dark:bg-transparent dark:border-emerald-800/30 sm:dark:border-transparent dark:hover:bg-emerald-900/30 transition-colors">
                  <span className="material-symbols-outlined text-[20px] sm:text-[18px]">add</span> Añadir nuevo criterio a la rúbrica
                </button>
              </div>
            </div>
          </div>
        )}

        {message && (
          <div className={`mt-6 p-4 rounded-xl flex items-center gap-3 font-medium shadow-sm border ${message.includes('correcta') ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/30 dark:border-green-800 dark:text-green-300' : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300'}`}>
            <span className="material-symbols-outlined">{message.includes('correcta') ? 'check_circle' : 'error'}</span>
            {message}
          </div>
        )}

        <div className="mt-10 pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3">
          <button type="button" onClick={onCancel} className="w-full sm:w-auto px-6 py-3 sm:py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 transition-colors text-center">Cancelar y Volver</button>
          <button type="submit" disabled={saving} className="w-full sm:w-auto justify-center px-8 py-3 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-lg shadow-blue-600/30 transition-all flex items-center gap-2 active:scale-[0.98]">
             {saving ? (
               <>
                 <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path></svg>
                 Guardando...
               </>
             ) : (
               <>
                 <span className="material-symbols-outlined text-[20px]">save</span>
                 {editSurvey ? 'Actualizar Encuesta' : 'Guardar Encuesta'}
               </>
             )}
          </button>
        </div>
      </form>
    </div>
  )
}
