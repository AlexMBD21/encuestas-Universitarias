import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';

const CategorySelect = ({ value, options, onChange, placeholder }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-5 py-4 bg-slate-50 border ${isOpen ? 'border-indigo-500 ring-4 ring-indigo-500/10 bg-white' : 'border-slate-100'} rounded-[1.25rem] text-slate-800 cursor-pointer font-medium flex items-center justify-between transition-all hover:bg-white hover:border-slate-300`}
      >
        <span className={value ? 'text-slate-800' : 'text-slate-300'}>
          {value || placeholder}
        </span>
        <span className={`material-symbols-outlined text-slate-400 text-[20px] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
          expand_more
        </span>
      </div>
      
      {isOpen && (
        <div className="absolute top-[calc(100%+8px)] left-0 w-full bg-white border border-slate-100 rounded-[1.5rem] shadow-2xl z-[100] py-2 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="max-h-64 overflow-y-auto overscroll-contain custom-scrollbar scroll-smooth">
             <div 
               className="px-5 py-3 text-sm font-bold text-slate-300 italic bg-slate-50/50 mb-1 pointer-events-none"
             >
               {placeholder}
             </div>
             {options.map((option: string) => (
               <div 
                 key={option}
                 onClick={() => { onChange(option); setIsOpen(false); }}
                 className={`px-5 py-3.5 text-sm font-semibold transition-all cursor-pointer flex items-center justify-between group ${value === option ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-indigo-50/50'}`}
               >
                 <span>{option}</span>
                 {value === option && <span className="material-symbols-outlined text-[18px]">check</span>}
               </div>
             ))}
          </div>
        </div>
      )}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>
    </div>
  );
};

export default function Inscripcion() {
  const { token } = useParams();
  const [survey, setSurvey] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Categorías permitidas
  const [globalAsignaturas, setGlobalAsignaturas] = useState<string[]>([]);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectCategory, setProjectCategory] = useState('');
  const [projectMembers, setProjectMembers] = useState('');
  const [projectAdvisor, setProjectAdvisor] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      if (!token) {
        setError('Token de inscripción no proporcionado.');
        setLoading(false);
        return;
      }
      try {
        const response = await fetch('/api/get_inscription_survey', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
           setError(result.error || 'El enlace no es válido o ha expirado.');
        } else {
           setSurvey(result.survey);
           
           let cats: string[] = [];
           if (result.globalCategories && Array.isArray(result.globalCategories) && result.globalCategories.length > 0) {
             cats = result.globalCategories;
           } else if (result.survey.allowed_categories && Array.isArray(result.survey.allowed_categories)) {
             cats = result.survey.allowed_categories;
           } else if (result.survey.allowedCategories && Array.isArray(result.survey.allowedCategories)) {
             cats = result.survey.allowedCategories;
           } else {
             cats = ["Ingeniería de Software", "Sistemas", "Electrónica", "Otros"];
           }
           setGlobalAsignaturas(cats);
        }
      } catch (err) {
        setError('Error al conectar con el servidor.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim() || !projectCategory.trim() || !projectMembers.trim()) {
      alert('Por favor completa todos los campos requeridos.');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch('/api/register_project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          projectData: {
            name: projectName.trim(),
            description: projectDescription.trim(),
            category: projectCategory.trim(),
            members: projectMembers.trim(),
            advisor: projectAdvisor.trim()
          }
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Error al registrar el proyecto');
      }

      setSuccess(true);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Hubo un error al registrar el proyecto.');
    } finally {
      setSubmitting(false);
    }
  };

  // --- LOADING STATE ---
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
        <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-500">
          <div className="relative">
            <div className="h-16 w-16 border-4 border-indigo-100 rounded-full"></div>
            <div className="h-16 w-16 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin absolute top-0"></div>
          </div>
          <span className="text-slate-500 font-bold tracking-tight text-lg">Validando invitación...</span>
        </div>
      </div>
    );
  }

  // --- ERROR STATE ---
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white p-8 rounded-[2.5rem] shadow-2xl shadow-indigo-100/50 text-center border border-slate-100 animate-in slide-in-from-bottom-5 duration-500">
          <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-6 rotate-3">
             <span className="material-symbols-outlined text-red-500 text-4xl">warning</span>
          </div>
          <h2 className="text-3xl font-black text-slate-800 mb-3 tracking-tight">Acceso denegado</h2>
          <p className="text-slate-500 font-medium text-lg leading-relaxed mb-8">{error}</p>
        </div>
      </div>
    );
  }

  // --- SUCCESS STATE ---
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white p-8 rounded-[2.5rem] shadow-2xl shadow-indigo-100/50 text-center border border-slate-100 animate-in slide-in-from-bottom-5 duration-500">
          <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto mb-6 -rotate-3">
             <span className="material-symbols-outlined text-emerald-500 text-4xl">check_circle</span>
          </div>
          <h2 className="text-3xl font-black text-slate-800 mb-3 tracking-tight">¡Genial!</h2>
          <p className="text-slate-500 font-medium text-lg leading-relaxed mb-8">
            El proyecto 
            <div className="text-indigo-600 font-bold text-xl my-4 break-words px-2 leading-tight">
              "{projectName}"
            </div>
            se ha registrado con éxito para la feria.
          </p>
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-slate-400 text-sm font-medium">
            Ya puedes cerrar este enlace.
          </div>
        </div>
      </div>
    );
  }

  // --- MAIN CONTENT ---
  return (
    <div className="min-h-screen bg-slate-50 pb-20 overflow-x-hidden">
      {/* Dynamic Splash Header */}
      <div className="bg-indigo-600 pt-12 pb-24 px-6 md:px-12 relative overflow-hidden">
        {/* Background elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-400/20 rounded-full -ml-10 -mb-10 blur-3xl pointer-events-none"></div>
        
        <div className="max-w-3xl mx-auto relative z-10 transition-all duration-700 animate-in fade-in slide-in-from-top-3">
          <div className="flex items-center gap-2 text-indigo-200 mb-4">
            <span className="material-symbols-outlined text-[20px]">how_to_reg</span>
            <span className="text-xs font-black uppercase tracking-widest">Inscripción Abierta</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight leading-none">
            Registro de Proyecto
          </h1>
          <p className="text-indigo-100 text-lg md:text-xl font-medium max-w-xl opacity-90">
            {survey.title}
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 -mt-12 relative z-20">
        {/* Timer/Deadline Card */}
        <div className="bg-white/70 backdrop-blur-xl border border-white rounded-[2rem] p-5 mb-8 shadow-xl shadow-indigo-100/30 flex items-center gap-4 animate-in fade-in zoom-in duration-700 delay-200">
           <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center shrink-0">
             <span className="material-symbols-outlined text-amber-500">timer</span>
           </div>
           <div>
             <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-0.5">Fecha límite de inscripción</p>
             <p className="text-slate-800 font-bold text-sm">
               {new Date(survey.linkExpiresAt || survey.link_expires_at).toLocaleDateString('es-ES', { 
                 day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute:'2-digit' 
               })}
             </p>
           </div>
        </div>

        {/* Main Form */}
        <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden animate-in slide-in-from-bottom-8 duration-1000">
          <div className="p-8 md:p-12">
            <form onSubmit={handleSubmit} className="space-y-8">
              
              {/* Informacion Principal */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-8 w-1 bg-indigo-600 rounded-full"></div>
                  <h3 className="text-lg font-black text-slate-800 tracking-tight">Detalles del Proyecto</h3>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2.5 ml-1">Nombre del Proyecto <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input 
                      type="text" 
                      required
                      maxLength={80}
                      value={projectName}
                      onChange={e => setProjectName(e.target.value)}
                      placeholder="Ej. Sistema de Monitoreo IoT..."
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-[1.25rem] focus:ring-4 focus:ring-indigo-500/10 focus:bg-white focus:border-indigo-500 text-slate-800 outline-none transition-all placeholder:text-slate-300 font-medium"
                    />
                    <div className="absolute top-1/2 -translate-y-1/2 right-4 flex items-center gap-2 pointer-events-none">
                      <span className={`text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full transition-colors ${projectName.length > 70 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                        {projectName.length}/80
                      </span>
                    </div>
                  </div>
                  
                  {/* Helper info field */}
                  <div className="mt-1.5 flex items-center justify-between px-1">
                    <p className="text-[10px] text-slate-400 font-medium">Nombre completo del proyecto, máximo 80 caracteres.</p>
                  </div>
                </div>

                {/* Descripción */}
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2.5 ml-1">Descripción del Proyecto</label>
                  <textarea 
                    value={projectDescription}
                    onChange={e => setProjectDescription(e.target.value)}
                    placeholder="Breve descripción de lo que trata el proyecto..."
                    rows={2}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-[1.25rem] focus:ring-4 focus:ring-indigo-500/10 focus:bg-white focus:border-indigo-500 text-slate-800 outline-none transition-all placeholder:text-slate-300 font-medium resize-none shadow-inner"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Categoría */}
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2.5 ml-1">Categoría <span className="text-red-500">*</span></label>
                    <CategorySelect
                      value={projectCategory}
                      options={globalAsignaturas}
                      onChange={setProjectCategory}
                      placeholder="Seleccionar..."
                    />
                  </div>

                  {/* Asesor */}
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2.5 ml-1">Profesor Asesor</label>
                    <input 
                      type="text" 
                      value={projectAdvisor}
                      onChange={e => setProjectAdvisor(e.target.value)}
                      placeholder="Nombre del asesor"
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-[1.25rem] focus:ring-4 focus:ring-indigo-500/10 focus:bg-white focus:border-indigo-500 text-slate-800 outline-none transition-all placeholder:text-slate-300 font-medium"
                    />
                  </div>
                </div>

                {/* Integrantes */}
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2.5 ml-1">Integrantes del Equipo <span className="text-red-500">*</span></label>
                  <textarea 
                    required
                    value={projectMembers}
                    onChange={e => setProjectMembers(e.target.value)}
                    placeholder="Escribe los nombres de los integrantes..."
                    rows={3}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-[1.25rem] focus:ring-4 focus:ring-indigo-500/10 focus:bg-white focus:border-indigo-500 text-slate-800 outline-none transition-all placeholder:text-slate-300 font-medium resize-none shadow-inner"
                  />
                  <p className="mt-2 text-[10px] text-slate-400 font-medium ml-1">Separa los nombres con comas si son varios.</p>
                </div>
              </div>

              <div className="pt-4">
                <button 
                  type="submit" 
                  disabled={submitting}
                  className={`w-full py-5 rounded-2xl text-lg font-black text-white shadow-2xl shadow-indigo-200/50 transition-all flex justify-center items-center gap-3 ${submitting ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-indigo-300/50 hover:-translate-y-1 active:translate-y-0 active:scale-[0.98]'}`}
                >
                  {submitting ? (
                    <>
                      <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      <span>Procesando...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[24px]">send</span> 
                      <span>Inscribir Proyecto</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
          
          <div className="bg-slate-50/50 p-6 text-center border-t border-slate-100">
            <p className="text-slate-400 text-xs font-bold">Encuestas Universitarias &copy; {new Date().getFullYear()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
