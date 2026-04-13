import React from 'react';
import ReactDOM from 'react-dom';
import { Modal } from '../../../components/ui/Modal';

const MultiEvaluatorSelector = ({ values, evaluatorUsers, onChange, onSave }: any) => {
  const emails = Array.isArray(values) ? values : (values ? [String(values)] : []);
  const [val, setVal] = React.useState('');
  const [focused, setFocused] = React.useState(false);
  const [isBrowsing, setIsBrowsing] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [rect, setRect] = React.useState<any>(null);

  const openDropdown = (browsing = false) => {
    if (inputRef.current) setRect(inputRef.current.getBoundingClientRect());
    setFocused(true);
    if (browsing) setIsBrowsing(true);
  }

  React.useEffect(() => {
    if (!focused) return;
    const updatePosition = () => { if (inputRef.current) setRect(inputRef.current.getBoundingClientRect()); };
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        const dropdown = document.querySelector('.evaluator-dropdown');
        if (dropdown && dropdown.contains(e.target as Node)) return;
        setFocused(false);
        onSave && onSave(emails);
      }
    };
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [focused, emails, onSave]);

  const addEmail = (email: string) => {
    const clean = email.trim().toLowerCase();
    if (!clean || emails.includes(clean)) { setVal(''); setFocused(false); return; }
    const newEmails = [...emails, clean];
    onChange && onChange(newEmails);
    setVal('');
    setFocused(false);
  }

  const removeEmail = (email: string) => {
    const newEmails = emails.filter(e => e !== email);
    onChange && onChange(newEmails);
  }

  const filtered = (evaluatorUsers || []).filter((u: any) => {
    const email = (u.email || '').toLowerCase();
    if (emails.includes(email)) return false;
    if (isBrowsing) return true;
    if (!val.trim()) return true;
    return email.includes(val.toLowerCase()) || (u.name || '').toLowerCase().includes(val.toLowerCase())
  });

  return (
    <div ref={containerRef} className="w-full space-y-2">
      {/* Selected Evaluators Chips */}
      {emails.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {emails.map(email => (
            <div key={email} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800/50 rounded-lg group transition-all hover:border-indigo-300">
              <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 truncate max-w-[150px]">{email}</span>
              <button 
                type="button" 
                onClick={() => removeEmail(email)}
                className="w-4 h-4 flex items-center justify-center rounded-full bg-indigo-200/50 text-indigo-600 hover:bg-indigo-500 hover:text-white transition-colors"
                title="Eliminar"
              >
                <span className="material-symbols-outlined text-[12px] font-bold">close</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input Field */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
          <span className="material-symbols-outlined text-[18px]">person_add</span>
        </div>
        <input
          ref={inputRef}
          type="text"
          placeholder={emails.length === 0 ? "Añadir evaluador..." : "Añadir otro..."}
          value={val}
          onFocus={() => openDropdown(true)}
          onClick={() => openDropdown(true)}
          onChange={(e) => {
            setVal(e.target.value);
            setIsBrowsing(false);
            openDropdown();
          }}
          className="w-full pl-9 pr-10 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm"
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-1.5">
          <button 
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              inputRef.current?.focus();
              openDropdown(true);
            }}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-indigo-500 transition-colors outline-none cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px] transition-transform duration-200" style={{ transform: focused ? 'rotate(180deg)' : 'rotate(0)' }}>expand_more</span>
          </button>
        </div>
      </div>

      {focused && rect && ReactDOM.createPortal(
        <div 
          style={{
            position: 'fixed',
            top: rect.bottom + 6,
            left: rect.left,
            width: rect.width,
            zIndex: 999999
          }}
          className="evaluator-dropdown bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-xl shadow-2xl overflow-hidden animate-fade-in-down origin-top"
        >
          <div className="max-h-[180px] overflow-y-auto overscroll-contain custom-scrollbar-sm">
            {filtered.length > 0 ? filtered.map((u: any) => (
              <div
                key={u.id || u.email}
                onMouseDown={(e) => {
                  e.preventDefault();
                  addEmail(u.email);
                }}
                className="group px-4 py-3 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer border-b border-slate-50 dark:border-slate-700/50 last:border-0 flex items-center gap-3 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors shrink-0">
                  <span className="material-symbols-outlined text-[16px]">account_circle</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">{u.name || (u.email ? u.email.split('@')[0] : 'Profesor')}</div>
                  <div className="text-[12px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{u.email}</div>
                  {u.asignatura && <div className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 mt-1 truncate px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-900/40 rounded inline-block uppercase tracking-wider">{u.asignatura}</div>}
                </div>
              </div>
            )) : (
              <div className="px-4 py-8 text-center flex flex-col items-center gap-2">
                <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 text-3xl">sentiment_dissatisfied</span>
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">No hay más profesores disponibles</span>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export const EvaluatorAssignmentModal = ({ isOpen, onClose, survey, evaluatorUsers, dataClientNow, onSave, onCancel }: any) => {
  const [draftProjects, setDraftProjects] = React.useState<any[]>(survey?.projects || []);
  const [saving, setSaving] = React.useState(false);
  const [expandedTitles, setExpandedTitles] = React.useState<Set<string>>(new Set());

  const toggleTitleExpansion = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setExpandedTitles(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  React.useEffect(() => {
    setDraftProjects(survey?.projects || []);
  }, [survey?.projects]);

  return (
    <Modal isOpen={isOpen} onClose={onClose || onCancel} maxWidth="max-w-3xl" hideMobileIndicator={true} scrollableBody={false}>
      <div className="flex flex-col h-full sm:max-h-[85vh] relative overflow-hidden">
        {/* Drag handle for mobile */}
        <div className="w-full flex justify-center pt-2 pb-2 sm:hidden absolute top-0 z-20 cursor-pointer" style={{ touchAction: 'none' }} onClick={onClose || onCancel}>
          <div className="w-12 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700"></div>
        </div>

        {/* Header — clean premium */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 shrink-0 rounded-t-[2rem] sm:rounded-[1.5rem] sm:rounded-b-none pt-8 sm:pt-4 z-10 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <h3 className="text-lg sm:text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Configurar Evaluadores</h3>
          <div className="hidden sm:block">
            <button
              type="button"
              onClick={onClose || onCancel}
              disabled={saving}
              className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors outline-none"
            >
              <span className="material-symbols-outlined text-[24px]">close</span>
            </button>
          </div>
        </div>
      {/* Fixed Instructions at the top */}
      <div className="p-4 sm:px-6 sm:py-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
        <p className="text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
          Asigna uno o más profesores evaluadores a cada proyecto. Los profesores asignados podrán revisar y calificar el proyecto de forma independiente desde su cuenta.
        </p>
      </div>

      {/* Scrollable Content Area */}
      <div className="modal-scrollable-content flex-1 overflow-y-auto w-full bg-slate-50 dark:bg-slate-900 p-4 sm:p-6 pt-5 pb-32 sm:pb-10">
        {draftProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center h-full">
            <span className="material-symbols-outlined text-[60px] text-slate-300 dark:text-slate-600 mb-4 opacity-75">inbox</span>
            <h4 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">Sin proyectos</h4>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 max-w-sm">
              Esta encuesta aún no tiene proyectos inscritos para evaluar.
            </p>
          </div>
        ) : (
          <div className="bg-transparent sm:bg-white dark:sm:bg-slate-800 rounded-xl sm:border sm:border-slate-200 dark:sm:border-slate-700 sm:shadow-sm overflow-visible min-h-[350px]">
            {/* Desktop Table View */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-xs uppercase font-bold text-slate-500 dark:text-slate-400">
                  <th className="p-3">Proyecto</th>
                  <th className="p-3 w-40">Categoría</th>
                  <th className="p-3 w-80">Evaluadores Asignados</th>
                </tr>
              </thead>
              <tbody>
                {draftProjects.map((p: any) => (
                  <tr key={p.id} className="border-b border-slate-100 dark:border-slate-700/50 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                    <td className="p-3">
                      <div 
                        onClick={(e) => toggleTitleExpansion(e, p.id)}
                        className={`font-bold text-sm text-slate-800 dark:text-slate-200 cursor-pointer transition-all break-all max-w-[250px] sm:max-w-[300px] ${expandedTitles.has(p.id) ? 'whitespace-normal' : 'line-clamp-2'}`} 
                        title={p.name}
                      >
                        {p.name || 'Sin nombre'}
                      </div>
                      <div className="text-xs text-slate-500 truncate max-w-[200px]">Asesor: {p.advisor || '-'}</div>
                    </td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-bold dark:bg-slate-800 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/50">
                        <span className="material-symbols-outlined text-[14px]">category</span>
                        {p.category || 'N/A'}
                      </span>
                    </td>
                    <td className="p-3 align-top pt-5">
                      <MultiEvaluatorSelector 
                        values={p.evaluators || (p.evaluator ? [p.evaluator] : [])}
                        evaluatorUsers={evaluatorUsers}
                        onChange={(newEmails: string[]) => {
                           setDraftProjects(prev => prev.map(x => x.id === p.id ? { ...x, evaluators: newEmails, evaluator: newEmails[0] || '' } : x));
                        }}
                        onSave={() => {}}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="block sm:hidden space-y-3">
            {draftProjects.map((p: any) => (
              <div key={p.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 shadow-sm">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="self-start inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[9px] font-black uppercase tracking-wider dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700/50">
                      <span className="material-symbols-outlined text-[11px]">category</span>
                      {p.category || 'N/A'}
                    </span>
                    <h4 
                      onClick={(e) => toggleTitleExpansion(e, p.id)}
                      className={`text-[13px] font-bold text-slate-800 dark:text-slate-100 leading-tight break-all cursor-pointer transition-all ${expandedTitles.has(p.id) ? 'whitespace-normal' : 'line-clamp-2'}`} 
                      title={p.name}
                    >
                      {p.name || 'Sin nombre'}
                    </h4>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">person</span>
                      {p.advisor || '-'}
                    </div>
                  </div>

                  {/* Evaluator Assignment Field */}
                  <div className="mt-1 pt-3 border-t border-slate-100 dark:border-slate-700/50">
                    <MultiEvaluatorSelector 
                      values={p.evaluators || (p.evaluator ? [p.evaluator] : [])}
                      evaluatorUsers={evaluatorUsers}
                      onChange={(newEmails: string[]) => {
                         setDraftProjects(prev => prev.map(x => x.id === p.id ? { ...x, evaluators: newEmails, evaluator: newEmails[0] || '' } : x));
                      }}
                      onSave={() => {}}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        )}
      </div>

      {/* Fixed Footer at the bottom */}
      <div className="border-t border-slate-200 dark:border-slate-800 p-4 sm:px-6 bg-white dark:bg-slate-900 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 shrink-0 z-20 relative">
        <button type="button" onClick={onClose || onCancel} disabled={saving} className="w-full sm:w-auto px-6 py-3 sm:py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 transition-all text-sm border border-slate-200 dark:border-slate-700">
          Cancelar y Volver
        </button>
        <button type="button" disabled={saving} onClick={async () => {
           setSaving(true);
           try {
             const updatedSurvey = { ...survey, projects: draftProjects };
             await dataClientNow.setSurvey(String(survey.id), updatedSurvey);
             onSave(updatedSurvey);
           } catch(e) { console.error(e) }
           finally { setSaving(false); }
        }} className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 sm:py-2.5 bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 border border-blue-600 hover:border-blue-700 text-white font-black rounded-2xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),0_4px_14px_0_rgba(37,99,235,0.3)] transition-all text-sm active:scale-[0.98]">
          {saving ? <span className="material-symbols-outlined text-[20px] animate-spin">refresh</span> : <span className="material-symbols-outlined text-[20px]">save</span>}
          {saving ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>
      </div>
    </Modal>
  )
}
