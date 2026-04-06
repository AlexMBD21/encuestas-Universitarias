import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import supabaseClient from '../../services/supabaseClient';

export default function Inscripcion() {
  const { token } = useParams();
  const [survey, setSurvey] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Global asignaturas
  const [globalAsignaturas, setGlobalAsignaturas] = useState<string[]>([]);

  const [projectName, setProjectName] = useState('');
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
        // Llamada a la API backend para evadir la restricción RLS
        // (ya que la encuesta JAMÁS está "published=true" si el link está activo)
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
           
           // Extraer categorías permitidas que el profesor configuró en esta feria
           let cats: string[] = [];
           if (result.survey.allowed_categories && Array.isArray(result.survey.allowed_categories) && result.survey.allowed_categories.length > 0) {
             cats = result.survey.allowed_categories;
           } else if (result.survey.allowedCategories && Array.isArray(result.survey.allowedCategories) && result.survey.allowedCategories.length > 0) {
             cats = result.survey.allowedCategories;
           } else {
             cats = ["Ingeniería de Software", "Sistemas", "Electrónica", "Otros"]; // Salvavidas mínimo si no configuró nada
           }
           setGlobalAsignaturas(cats);
        }
        
      } catch (err) {
        setError('Error al validar el enlace con el servidor.');
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
      alert(err.message || 'Hubo un error al registrar el proyecto. Puede que requieras permisos.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-10 w-10 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-slate-500 font-medium">Verificando enlace...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl text-center border-t-4 border-red-500">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
             <span className="material-symbols-outlined text-red-500 text-3xl">error</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Enlace no válido</h2>
          <p className="text-slate-600 mb-6">{error}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl text-center border-t-4 border-emerald-500">
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
             <span className="material-symbols-outlined text-emerald-500 text-3xl">check_circle</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">¡Inscripción Exitosa!</h2>
          <p className="text-slate-600 mb-6">Tu proyecto "{projectName}" ha sido registrado correctamente para competir en la feria.</p>
        </div>
      </div>
    );
  }

  const allowedCategories = survey.allowedCategories || survey.allowed_categories || [];

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 flex justify-center">
      <div className="max-w-2xl w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-8 py-10 text-white relative">
          <div className="absolute top-0 right-0 -mt-2 -mr-2 opacity-10">
            <span className="material-symbols-outlined text-[150px]">rocket_launch</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black mb-2 relative z-10 tracking-tight">Registro de Proyecto</h1>
          <p className="text-indigo-100 text-lg font-medium relative z-10">{survey.title}</p>
        </div>
        
        <div className="p-8 pb-10">
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 mb-8 flex gap-3 text-sm font-medium">
             <span className="material-symbols-outlined shrink-0 text-amber-500">timer</span>
             <p>Este formulario de inscripción estará disponible hasta el <b>{new Date(survey.linkExpiresAt || survey.link_expires_at).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute:'2-digit' })}</b>.</p>
          </div>

          <form onSubmit={handleSubmit} className="relative bg-white border border-slate-200 rounded-2xl p-5 shadow-sm overflow-hidden mb-6">
            <div className="absolute top-0 left-0 w-full h-1 bg-indigo-400"></div>
            
            <div className="flex justify-between items-center mb-6">
              <span className="bg-indigo-50 text-indigo-700 px-2.5 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">folder</span> Formulario de Inscripción
              </span>
            </div>

            <div className="space-y-5">
              {/* Nombre del Proyecto */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nombre del Proyecto <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  required
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  placeholder="Ej. App de Gestión..."
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:border-indigo-500 text-slate-800 outline-none transition-all placeholder:text-slate-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Categoría */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Categoría <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <select
                      required
                      value={projectCategory}
                      onChange={e => setProjectCategory(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:border-indigo-500 text-slate-800 outline-none transition-all appearance-none cursor-pointer"
                    >
                      <option value="" disabled>(Selecciona una categoría)</option>
                      {globalAsignaturas.map((c: string) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[20px] select-none">expand_more</span>
                  </div>
                </div>

                {/* Asesor */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Profesor Asesor</label>
                  <input 
                    type="text" 
                    value={projectAdvisor}
                    onChange={e => setProjectAdvisor(e.target.value)}
                    placeholder="Nombre del asesor"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:border-indigo-500 text-slate-800 outline-none transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Integrantes */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Integrantes del Equipo <span className="text-red-500">*</span></label>
                <textarea 
                  required
                  value={projectMembers}
                  onChange={e => setProjectMembers(e.target.value)}
                  placeholder="Nombres de los integrantes..."
                  rows={2}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:border-indigo-500 text-slate-800 outline-none transition-all placeholder:text-slate-400 resize-none"
                />
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={submitting}
                  className={`w-full py-4 rounded-xl text-lg font-bold text-white shadow-xl shadow-indigo-600/30 transition-all flex justify-center items-center gap-2 ${submitting ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 hover:-translate-y-1 active:translate-y-0 active:scale-[0.99]'}`}
                >
                  {submitting ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      Enviando Inscripción...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[20px]">how_to_reg</span> Enviar Inscripción de Proyecto
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
}
