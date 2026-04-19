import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Modal } from '../../components/ui/Modal';
import Loader from '../../components/Loader';

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
        className={`w-full px-5 py-4 bg-slate-950/50 border ${isOpen ? 'border-blue-500 ring-4 ring-blue-500/10 bg-slate-900/80' : 'border-slate-700/50'} rounded-[1.25rem] text-white cursor-pointer font-medium flex items-center justify-between transition-all hover:bg-slate-900/80 hover:border-slate-600`}
      >
        <span className={value ? 'text-white' : 'text-slate-400'}>
          {value || placeholder}
        </span>
        <span className={`material-symbols-outlined text-slate-400 text-[20px] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
          expand_more
        </span>
      </div>
      
      {isOpen && (
        <div className="absolute top-[calc(100%+8px)] left-0 w-full bg-[#0f172a] border border-slate-700/50 rounded-[1.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[100] py-2 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 backdrop-blur-3xl">
          <div className="max-h-64 overflow-y-auto overscroll-contain custom-scrollbar scroll-smooth">
             <div 
               className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest bg-slate-900/30 mb-1 pointer-events-none"
             >
               {placeholder}
             </div>
             {options.map((option: string) => (
               <div 
                 key={option}
                 onClick={() => { onChange(option); setIsOpen(false); }}
                 className={`px-5 py-3.5 text-sm font-semibold transition-all cursor-pointer flex items-center justify-between group ${value === option ? 'bg-blue-500/10 text-blue-400' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
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
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
      `}</style>
    </div>
  );
};

export default function Inscripcion() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [survey, setSurvey] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Email Validation Step State
  const [email, setEmail] = useState('');
  const [isEmailConfirmed, setIsEmailConfirmed] = useState(false);

  // Form State
  const [globalAsignaturas, setGlobalAsignaturas] = useState<string[]>([]);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectCategory, setProjectCategory] = useState('');
  const [projectMembers, setProjectMembers] = useState('');
  const [projectAdvisor, setProjectAdvisor] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

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

  const handleIdentify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !token) return;
    
    // Re-validar que el enlace siga activo en caso de demora
    setLoading(true);
    try {
      const response = await fetch('/api/get_inscription_survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const result = await response.json();
      if (!response.ok) {
         setError(result.error || 'El enlace de inscripción ha sido cerrado o ya no es válido.');
      } else {
         setIsEmailConfirmed(true);
      }
    } catch (err) {
      setError('Error al verificar el enlace de inscripción.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim() || !projectCategory.trim() || !projectMembers.trim()) {
      setModalError('Por favor completa todos los campos requeridos.');
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
            advisor: projectAdvisor.trim(),
            email: email.trim() // Pass the collected email
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
      setModalError(err.message || 'Hubo un error al registrar el proyecto.');
    } finally {
      setSubmitting(false);
    }
  };

  // --- LOADING STATE ---
  if (loading) {
    return <Loader fullScreen text="Validando invitación..." />;
  }

  // --- ERROR STATE ---
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#020617] font-outfit relative overflow-hidden">
        <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_0%,_#0f172a_0%,_#020617_100%)]"></div>
        <div className="relative z-10 w-full max-w-md bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[30px] p-8 md:p-12 shadow-[0_40px_100px_rgba(0,0,0,0.5)] flex flex-col items-center text-center animate-fade-in-up">
          <div className="w-16 h-16 bg-rose-500/20 text-rose-500 border border-rose-500/50 flex items-center justify-center rounded-full mb-6 shadow-[0_0_50px_rgba(244,63,94,0.3)]">
            <span className="material-symbols-outlined text-3xl">link_off</span>
          </div>
          <h2 className="text-2xl font-black text-white mb-2">Acceso No Disponible</h2>
          <p className="text-sm font-medium text-slate-400 mb-8 leading-relaxed">{error}</p>
          <button onClick={() => navigate('/')} className="w-full bg-slate-800 text-white font-black py-4 rounded-[18px] hover:bg-slate-700 transition-all border border-white/10 shadow-lg">Volver al Inicio</button>
        </div>
      </div>
    );
  }

  // --- SUCCESS STATE ---
  if (success) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 relative overflow-hidden font-outfit">
        <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_0%,_#0f172a_0%,_#020617_100%)]">
           <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-emerald-600/20 rounded-full blur-[120px] opacity-60"></div>
        </div>

        <div className="relative z-10 w-full max-w-md bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[30px] p-10 md:p-12 shadow-[0_40px_100px_rgba(0,0,0,0.5)] animate-fade-in-up text-center flex flex-col items-center">
          <div className="w-24 h-24 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center mb-8 shadow-[0_0_50px_rgba(16,185,129,0.3)]">
            <span className="material-symbols-outlined text-emerald-400 text-[50px]">task_alt</span>
          </div>

          <h2 className="text-3xl font-black text-white px-2 mb-4 tracking-tight">¡Genial!</h2>
          
          <p className="text-sm font-medium text-slate-400 leading-relaxed mb-6">
            El proyecto <span className="text-blue-400 font-bold">"{projectName}"</span> se ha registrado con éxito para el evento. Acabamos de confirmar tu inscripción.
          </p>

          <button 
            onClick={() => {
              setIsEmailConfirmed(false);
              setProjectName('');
              setProjectDescription('');
              setProjectMembers('');
              setProjectAdvisor('');
              setProjectCategory('');
              setSuccess(false);
              setEmail('');
            }} 
            className="w-full bg-slate-800 text-white font-black py-4 rounded-[18px] hover:bg-slate-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2 uppercase tracking-widest text-xs border border-white/10"
          >
            <span className="material-symbols-outlined text-lg">replay</span>
            Registrar Otro
          </button>
        </div>
      </div>
    );
  }

  // --- IDENTIFICATION STATE (Step 1) ---
  if (!isEmailConfirmed) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden bg-[radial-gradient(circle_at_50%_0%,_#0f172a_0%,_#020617_100%)]">
          <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-blue-600/20 rounded-full blur-[120px] opacity-60"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px] opacity-50"></div>
        </div>
        
        <div className="relative z-10 w-full max-w-md bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[30px] p-8 md:p-12 shadow-[0_40px_100px_rgba(0,0,0,0.5)]">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 border border-white/20 mb-6">
              <span className="material-symbols-outlined text-white text-[28px]">how_to_reg</span>
            </div>
            <h1 className="text-2xl font-black text-white px-2">Identificación</h1>
            <p className="text-sm font-medium text-slate-400 mt-2">Ingresa tu correo para comenzar la inscripción de proyecto a la feria.</p>
          </div>

          <form onSubmit={handleIdentify} className="space-y-6">
            <div className="space-y-2">
              <input 
                type="email" 
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                className="w-full bg-slate-950/50 border-2 border-slate-700/50 focus:border-blue-500/50 focus:bg-slate-900/80 rounded-2xl p-4 text-sm font-medium outline-none text-white transition-all"
              />
            </div>

            <button 
              type="submit"
              disabled={!email.trim()}
              className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-lg hover:bg-blue-500 transition-all active:scale-[0.98] disabled:opacity-50 uppercase tracking-widest text-[11px]"
            >
              Comenzar Inscripción
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- MAIN CONTENT (Step 2) ---
  return (
    <div className="min-h-screen bg-[#020617] flex flex-col items-center py-8 px-3 sm:py-10 sm:px-4 relative overflow-hidden">
      
      {/* Fondo estético tipo Celestial */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden bg-[radial-gradient(circle_at_50%_0%,_#0f172a_0%,_#020617_100%)]">
         <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-blue-600/20 rounded-full blur-[120px] opacity-60"></div>
         <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px] opacity-50"></div>
      </div>

      {/* Header Info */}
      <div className="w-full max-w-2xl text-center mb-6 relative z-10 px-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 mb-6">
          <span className="material-symbols-outlined text-white text-[28px]">add_box</span>
        </div>
        <div className="flex items-center justify-center gap-2 text-blue-300 mb-2">
          <span className="material-symbols-outlined text-[16px]">event</span>
          <span className="text-[10px] font-black uppercase tracking-widest">Formulario de Inscripción</span>
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white mb-2 sm:mb-3 tracking-tight">
          Registro de Proyecto
        </h1>
        <p className="text-sm font-medium text-slate-400">
          Inscripción para: <strong className="text-blue-300 ml-1">{survey ? survey.title : ''}</strong>
        </p>
      </div>

      {/* Form Container */}
      <div className="relative z-10 w-full max-w-2xl bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-[0_40px_100px_rgba(0,0,0,0.5)] overflow-hidden">
        
        {/* Timer/Deadline Ribbon */}
        <div className="bg-white/5 border-b border-white/5 p-4 flex items-center justify-center gap-3">
           <span className="material-symbols-outlined text-amber-500 text-[18px]">timer</span>
           <div className="flex items-center gap-2">
             <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Cierre:</span>
             <span className="text-amber-400 font-bold text-xs tracking-wider">
               {survey ? new Date(survey.linkExpiresAt || survey.link_expires_at || Date.now()).toLocaleDateString('es-ES', { 
                 day: 'numeric', month: 'short', hour: '2-digit', minute:'2-digit' 
               }) : ''}
             </span>
           </div>
        </div>

        <div className="p-5 sm:p-8 md:p-10">
          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* Informacion Principal */}
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5 ml-2">Nombre del Proyecto <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <input 
                    type="text" 
                    required
                    maxLength={80}
                    value={projectName}
                    onChange={e => setProjectName(e.target.value.slice(0, 80))}
                    placeholder="Ej. Sistema de Monitoreo IoT..."
                    className="w-full px-5 py-4 bg-slate-950/50 border border-slate-700/50 rounded-[1.25rem] focus:ring-4 focus:ring-blue-500/10 focus:bg-slate-900/80 focus:border-blue-500 text-white outline-none transition-all placeholder:text-slate-600 font-medium"
                  />
                  <div className="absolute top-1/2 -translate-y-1/2 right-4 flex items-center gap-2 pointer-events-none">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${projectName.length > 70 ? 'bg-amber-500/20 text-amber-400' : 'bg-white/10 text-slate-400'}`}>
                      {projectName.length}/80
                    </span>
                  </div>
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5 ml-2">Breve Descripción <span className="text-slate-600 text-[9px] font-normal lowercase">(Opcional)</span></label>
                <textarea 
                  value={projectDescription}
                  onChange={e => setProjectDescription(e.target.value)}
                  placeholder="De qué trata el proyecto..."
                  rows={2}
                  className="w-full px-5 py-4 bg-slate-950/50 border border-slate-700/50 rounded-[1.25rem] focus:ring-4 focus:ring-blue-500/10 focus:bg-slate-900/80 focus:border-blue-500 text-white outline-none transition-all placeholder:text-slate-600 font-medium resize-none shadow-inner"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-50">
                {/* Categoría */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5 ml-2">Materia / Categoría <span className="text-rose-500">*</span></label>
                  <CategorySelect
                    value={projectCategory}
                    options={globalAsignaturas}
                    onChange={setProjectCategory}
                    placeholder="Seleccionar..."
                  />
                </div>

                {/* Asesor */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5 ml-2">Profesor Asesor</label>
                  <input 
                    type="text" 
                    value={projectAdvisor}
                    onChange={e => setProjectAdvisor(e.target.value)}
                    placeholder="Nombre del asesor"
                    className="w-full px-5 py-4 bg-slate-950/50 border border-slate-700/50 rounded-[1.25rem] focus:ring-4 focus:ring-blue-500/10 focus:bg-slate-900/80 focus:border-blue-500 text-white outline-none transition-all placeholder:text-slate-600 font-medium"
                  />
                </div>
              </div>

              {/* Integrantes */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5 ml-2">Integrantes del Equipo <span className="text-rose-500">*</span></label>
                <textarea 
                  required
                  value={projectMembers}
                  onChange={e => setProjectMembers(e.target.value)}
                  placeholder="Separa los nombres con comas..."
                  rows={3}
                  className="w-full px-5 py-4 bg-slate-950/50 border border-slate-700/50 rounded-[1.25rem] focus:ring-4 focus:ring-blue-500/10 focus:bg-slate-900/80 focus:border-blue-500 text-white outline-none transition-all placeholder:text-slate-600 font-medium resize-none shadow-inner"
                />
              </div>
            </div>

            <div className="pt-6">
               <div className="text-center mb-6">
                 <p className="text-xs text-slate-500 font-medium inline-flex items-center gap-2">
                    <span className="material-symbols-outlined text-[14px]">account_circle</span>
                    Registrando en nombre de: <strong className="text-slate-300">{email}</strong>
                 </p>
               </div>
              <button 
                type="submit" 
                disabled={submitting}
                className={`w-full py-5 rounded-2xl text-sm font-black text-white shadow-xl transition-all flex justify-center items-center gap-3 relative overflow-hidden uppercase tracking-widest ${submitting ? 'bg-blue-900/50 opacity-70 cursor-not-allowed border border-blue-700/50' : 'bg-blue-600 hover:bg-blue-500 hover:shadow-blue-500/30 hover:-translate-y-1 active:translate-y-0 active:scale-[0.98] border border-blue-500'}`}
              >
                {submitting ? (
                  <>
                    <Loader size={20} text={null} innerColor="#cbd5e1" outerColor="#ffffff" />
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[20px]">how_to_reg</span> 
                    <span>Completar Inscripción</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
        
        <div className="bg-white/5 p-4 text-center border-t border-white/5">
          <p className="text-slate-600 text-[10px] font-black uppercase tracking-widest">Encuestas Universitarias</p>
        </div>
      </div>
      
      {/* Premium Error Modal */}
      <Modal isOpen={!!modalError} onClose={() => setModalError(null)} maxWidth="max-w-md" hideMobileIndicator={true}>
        <div className="flex flex-col h-full sm:max-h-[80vh] relative overflow-hidden bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl shadow-2xl">
          <div className="w-full flex justify-center pt-2 pb-3 sm:hidden absolute top-0 z-20 cursor-pointer" style={{ touchAction: 'none' }} onClick={() => setModalError(null)}>
            <div className="w-12 h-1.5 rounded-full bg-white/30" />
          </div>
          <div className="p-8 text-center flex-1 overflow-y-auto mt-4">
            <div className="w-20 h-20 bg-rose-500/20 border border-rose-500/30 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(244,63,94,0.3)]">
               <span className="material-symbols-outlined text-rose-400 text-[40px] drop-shadow-sm">warning</span>
            </div>
            <h3 className="text-2xl font-black text-white mb-3 tracking-tight">Oops...</h3>
            <p className="text-slate-400 font-medium mb-8 text-sm">
              {modalError}
            </p>
            <button 
              onClick={() => setModalError(null)}
              className="w-full py-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-black uppercase tracking-widest text-[11px] rounded-2xl transition-all active:scale-[0.98]"
            >
              Entendido
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
