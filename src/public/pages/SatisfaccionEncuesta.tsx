import React, { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useSatisfaccion } from '../../hooks/useSatisfaccion';
import Loader from '../../components/Loader';
import { getOrCreateSatisfaccionToken } from '../../services/satisfaccion.service';

export default function SatisfaccionEncuesta() {
  const { token: urlToken, surveyId: urlSurveyId } = useParams<{ token?: string, surveyId?: string }>();
  const [searchParams] = useSearchParams();
  const urlPublicToken = searchParams.get('t') || '';
  const navigate = useNavigate();
  const [token, setToken] = useState<string | undefined>(urlToken);
  const { loading, error, surveyData, isSubmitting, isSuccess, submit } = useSatisfaccion(token);

  const [email, setEmail] = useState('');
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [idError, setIdError] = useState<string | null>(null);

  const [estrellas, setEstrellas] = useState<number>(0);
  const [nps, setNps] = useState<number | null>(null);
  const [aspecto, setAspecto] = useState<string>('');
  const [comentario, setComentario] = useState<string>('');
  
  const ASPECTOS = ['Contenido', 'Claridad', 'Dificultad apropiada', 'Relevancia', 'Tiempo asignado'];

  const handleIdentify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !urlSurveyId) return;
    setIsIdentifying(true);
    setIdError(null);
    try {
      const newToken = await getOrCreateSatisfaccionToken(urlSurveyId, email, urlPublicToken);
      if (newToken) {
        setToken(newToken);
      } else {
        setIdError('No pudimos validar tu acceso o el enlace ha expirado.');
      }
    } catch (err) {
      setIdError('Error de conexión.');
    } finally {
      setIsIdentifying(false);
    }
  };

  if (loading || isIdentifying) return <Loader fullScreen text={isIdentifying ? "Validando tu correo..." : "Cargando encuesta de satisfacción..."} />;

  // PANTALLA DE IDENTIFICACIÓN: Si entramos por surveyId y no tenemos token aún
  if (urlSurveyId && !token) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden bg-[radial-gradient(circle_at_50%_0%,_#0f172a_0%,_#020617_100%)]">
          <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-blue-600/20 rounded-full blur-[120px] opacity-60"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px] opacity-50"></div>
        </div>
        <div className="relative z-10 w-full max-w-md bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[30px] p-8 md:p-12 shadow-[0_40px_100px_rgba(0,0,0,0.5)]">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 border border-white/20 mb-6">
              <span className="material-symbols-outlined text-white text-[28px]">mail</span>
            </div>
            <h1 className="text-2xl font-black text-white px-2">Identificación</h1>
            <p className="text-sm font-medium text-slate-400 mt-2">Ingresa tu correo para comenzar la encuesta de satisfacción</p>
          </div>

          <form onSubmit={handleIdentify} className="space-y-6">
            <div className="space-y-2">
              <input 
                type="email" 
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                className="w-full bg-slate-950/50 border-2 border-slate-700/50 focus:border-indigo-500/50 focus:bg-slate-900/80 rounded-2xl p-4 text-sm font-medium outline-none text-white transition-all"
              />
              {idError && <p className="text-rose-400 text-[10px] font-bold uppercase tracking-wider px-2">{idError}</p>}
            </div>

            <button 
              type="submit"
              disabled={!email.trim()}
              className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-blue-500 hover:shadow-blue-500/30 hover:-translate-y-0.5 transition-all active:scale-[0.98] disabled:opacity-50 uppercase tracking-widest text-[11px] border border-blue-500"
            >
              Comenzar Encuesta
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (error || (surveyData && surveyData.__expired)) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white max-w-md w-full p-8 rounded-3xl shadow-xl flex flex-col items-center text-center border border-slate-100 animate-fade-in-up">
          <div className="w-16 h-16 bg-rose-100 text-rose-500 flex items-center justify-center rounded-full mb-6">
            <span className="material-symbols-outlined text-3xl">{surveyData?.__expired ? 'timer_off' : 'error'}</span>
          </div>
          <h2 className="text-xl font-black text-slate-800 mb-2">{surveyData?.__expired ? 'Enlace Expirado' : 'Acceso No Disponible'}</h2>
          <p className="text-sm font-medium text-slate-500 mb-8">{surveyData?.__expired ? 'Este enlace de satisfacción ya no está vigente. Contacta al profesor si crees que es un error.' : error}</p>
          <button onClick={() => navigate('/')} className="btn btn-primary w-full shadow-lg">Volver al Inicio</button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (estrellas === 0 || nps === null || !aspecto) return;
    const isPublicMode = !!(surveyData?.__publicMode);
    const success = await submit(
      {
        satisfaccion_estrellas: estrellas,
        nps: nps,
        aspecto_destacado: aspecto,
        comentario: comentario.trim() || null,
        respondida_en: new Date().toISOString()
      },
      isPublicMode ? { survey_id: String(surveyData.survey_id) } : undefined
    );
    if (success) {
      if (urlSurveyId) {
        navigate(`/satisfaccion/success?surveyId=${urlSurveyId}`, { replace: true });
      } else {
        navigate(`/satisfaccion/success`, { replace: true });
      }
    }
  };

  const isFormComplete = estrellas > 0 && nps !== null && aspecto !== '';

  return (
    <div className="min-h-screen bg-[#020617] flex flex-col items-center py-10 px-6 relative overflow-hidden">
      
      {/* Fondo estético tipo Celestial - idéntico al de Proyecto */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden bg-[radial-gradient(circle_at_50%_0%,_#0f172a_0%,_#020617_100%)]">
         <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-blue-600/20 rounded-full blur-[120px] opacity-60"></div>
         <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px] opacity-50"></div>
      </div>

      <div className="relative z-10 w-full max-w-2xl bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[30px] shadow-[0_40px_100px_rgba(0,0,0,0.5)] overflow-hidden">

        {/* Timer/Deadline Ribbon */}
        {surveyData?.token_expires_at || surveyData?.satisfaccion_expires_at ? (
          <div className="bg-white/5 border-b border-white/5 p-4 flex items-center justify-center gap-3">
            <span className="material-symbols-outlined text-amber-500 text-[18px]">timer</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Cierre:</span>
              <span className="text-amber-400 font-bold text-xs tracking-wider">
                {new Date(surveyData.token_expires_at || surveyData.satisfaccion_expires_at).toLocaleDateString('es-ES', {
                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                })}
              </span>
            </div>
          </div>
        ) : null}

        <div className="p-8 md:p-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 mb-6">
            <span className="material-symbols-outlined text-white text-[28px]">rate_review</span>
          </div>
          <h1 className="text-3xl font-black text-white px-2">Encuesta de Satisfacción</h1>
          <p className="text-sm font-medium text-slate-400 mt-2">
            Valoración para: <strong className="text-blue-300">{surveyData?.surveys?.title || 'Actividad Evaluada'}</strong>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-10">
          
          {/* Pregunta 1: Estrellas (Reemplazado por Emojis) */}
          <div className="space-y-4">
            <label className="block text-sm font-bold text-white text-center">1. ¿Qué tan satisfecho/a estás con la actividad evaluada?</label>
            <div className="flex justify-center gap-2 md:gap-4">
              {[1, 2, 3, 4, 5].map((cert, i) => {
                const EMOJIS = ['😡', '🙁', '😐', '🙂', '🤩'];
                const isActive = estrellas === cert;
                return (
                 <button
                   key={cert}
                   type="button"
                   onClick={() => setEstrellas(cert)}
                   className={`w-14 h-14 md:w-20 md:h-20 flex items-center justify-center rounded-3xl transition-all duration-300 transform ${
                     isActive 
                       ? 'bg-white/10 shadow-[0_0_30px_rgba(255,255,255,0.1)] scale-[1.15]' 
                       : 'bg-transparent hover:bg-white/5 hover:scale-110'
                   }`}
                 >
                   <span className={`text-[40px] md:text-[50px] transition-all duration-300 ${!isActive && estrellas > 0 ? 'opacity-40 grayscale-[0.8]' : 'opacity-100'}`}>
                     {EMOJIS[i]}
                   </span>
                 </button>
                )
              })}
            </div>
          </div>

          {/* Pregunta 2: NPS */}
          <div className="space-y-4 pt-4 border-t border-white/10">
            <label className="block text-sm font-bold text-white text-center">2. ¿Con qué probabilidad recomendarías esta actividad a otros?</label>
            <div className="flex justify-between w-full text-[10px] uppercase font-black tracking-widest text-slate-500 px-2 pb-2">
              <span>Poco probable</span>
              <span>Muy probable</span>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(score => (
                <button
                   key={score}
                   type="button"
                   onClick={() => setNps(score)}
                   className={`w-10 h-10 md:w-11 md:h-11 flex items-center justify-center border transition-all duration-300 ${
                     score <= 6 ? 'rounded-[12px] md:rounded-[14px]' : score <= 8 ? 'rounded-[12px] md:rounded-[14px]' : 'rounded-[12px] md:rounded-[14px]'
                   } ${
                     nps === score 
                     ? (score <= 6 ? 'bg-rose-500 border-rose-400 text-white shadow-[0_0_15px_rgba(244,63,94,0.4)] scale-110' : score <= 8 ? 'bg-amber-500 border-amber-400 text-white shadow-[0_0_15px_rgba(245,158,11,0.4)] scale-110' : 'bg-emerald-500 border-emerald-400 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)] scale-110')
                     : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                   }`}
                >
                  <span className="font-black">{score}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Pregunta 3: Aspecto */}
          <div className="space-y-4 pt-4 border-t border-white/10">
            <label className="block text-sm font-bold text-white text-center">3. ¿Qué aspecto destaca más de la actividad?</label>
            <div className="flex flex-wrap justify-center gap-3">
              {ASPECTOS.map(asp => (
                <button
                  key={asp}
                  type="button"
                  onClick={() => setAspecto(asp)}
                  className={`px-5 py-3 rounded-full text-xs font-black uppercase tracking-wider transition-all duration-300 ${
                    aspecto === asp 
                      ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)] border border-blue-400' 
                      : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10'
                  }`}
                >
                  {asp}
                </button>
              ))}
            </div>
          </div>

          {/* Pregunta 4: Comentario Libre */}
          <div className="space-y-3 pt-4 border-t border-white/10">
             <label className="block text-sm font-bold text-white text-center">4. ¿Tienes algún comentario adicional? (Opcional)</label>
             <textarea 
               value={comentario}
               onChange={e => setComentario(e.target.value)}
               className="w-full bg-slate-950/50 border-2 border-slate-700/50 focus:border-blue-500/50 focus:bg-slate-900/80 rounded-[22px] p-5 text-sm font-medium transition-all outline-none text-white placeholder:text-slate-600 resize-none min-h-[120px]"
               placeholder="Escribe tu opinión aquí..."
             ></textarea>
          </div>

          <div className="pt-6">
            {email && (
              <div className="text-center mb-5">
                <p className="text-xs text-slate-500 font-medium inline-flex items-center gap-2">
                  <span className="material-symbols-outlined text-[14px]">account_circle</span>
                  Respondiendo como: <strong className="text-slate-300">{email}</strong>
                </p>
              </div>
            )}
            <button 
              type="submit" 
              disabled={isSubmitting || !isFormComplete}
              className="w-full bg-blue-600 text-white font-black py-5 rounded-[22px] shadow-xl hover:bg-blue-500 hover:shadow-blue-500/30 hover:-translate-y-0.5 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-3 uppercase tracking-widest text-xs border border-blue-500"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  <span>Enviando...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-xl">send</span>
                  <span>Enviar Calificación</span>
                </>
              )}
            </button>
          </div>

        </form>
        </div>{/* end padding wrapper */}

        {/* Footer */}
        <div className="bg-white/5 p-4 text-center border-t border-white/5">
          <p className="text-slate-600 text-[10px] font-black uppercase tracking-widest">Encuestas Universitarias</p>
        </div>

      </div>

    </div>
  );
}
