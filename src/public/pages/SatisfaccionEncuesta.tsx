import React, { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useSatisfaccion } from '../../hooks/useSatisfaccion';
import Loader from '../../components/Loader';
import { getOrCreateSatisfaccionToken } from '../../services/satisfaccion.service';
import ButtonLoader from '../../components/ButtonLoader';
import AuthAdapter from '../../services/AuthAdapter';

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

  const [isValidatingLink, setIsValidatingLink] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  React.useEffect(() => {
    // Auto-identify if user is already logged in
    if (urlSurveyId && !token) {
      const user = AuthAdapter.getUser();
      if (user && user.email) {
        setEmail(user.email);
        const autoIdentify = async () => {
          setIsIdentifying(true);
          try {
            const newToken = await getOrCreateSatisfaccionToken(urlSurveyId, user.email, urlPublicToken);
            if (newToken) setToken(newToken);
          } catch (e) {}
          finally { setIsIdentifying(false); }
        };
        autoIdentify();
      }
    }

    if (urlSurveyId && !token && urlPublicToken) {
      setIsValidatingLink(true);
      import('../../services/supabaseClient').then(({ getRawSupabaseClient }) => {
        const supabase = getRawSupabaseClient();
        if (!supabase) {
          setIsValidatingLink(false);
          return;
        }
        supabase.from('surveys')
          .select('satisfaccion_token, satisfaccion_expires_at')
          .eq('id', urlSurveyId)
          .maybeSingle()
          .then(({ data }) => {
            if (!data) {
              setLinkError('Encuesta no encontrada.');
            } else if (data.satisfaccion_expires_at && new Date(data.satisfaccion_expires_at) < new Date()) {
              setLinkError('Este enlace de satisfacción ha expirado.');
            } else if (!data.satisfaccion_token || data.satisfaccion_token !== urlPublicToken) {
              setLinkError('Este enlace de satisfacción ha sido cerrado o ya no es válido.');
            }
            setIsValidatingLink(false);
          });
      });
    }
  }, [urlSurveyId, urlPublicToken, token]);

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
        setLinkError('Este enlace de satisfacción ha sido cerrado o ya no es válido.');
      }
    } catch (err) {
      setLinkError('Error de conexión al validar el enlace.');
    } finally {
      setIsIdentifying(false);
    }
  };

  if (loading || isIdentifying || isValidatingLink) return <Loader fullScreen text={isIdentifying ? "Validando tu correo..." : isValidatingLink ? "Verificando enlace..." : "Cargando encuesta de satisfacción..."} />;

  if (linkError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#020617] font-outfit relative overflow-hidden">
        <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_0%,_#0f172a_0%,_#020617_100%)]"></div>
        <div className="relative z-10 w-full max-w-md bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[30px] p-8 md:p-12 shadow-[0_40px_100px_rgba(0,0,0,0.5)] flex flex-col items-center text-center animate-fade-in-up">
          <div className="w-16 h-16 bg-rose-500/20 text-rose-500 border border-rose-500/50 flex items-center justify-center rounded-full mb-6 shadow-[0_0_50px_rgba(244,63,94,0.3)]">
            <span className="material-symbols-outlined text-3xl">link_off</span>
          </div>
          <h2 className="text-2xl font-black text-white mb-2">Acceso No Disponible</h2>
          <p className="text-sm font-medium text-slate-400 mb-8 leading-relaxed">{linkError}</p>
          <button onClick={() => navigate('/')} className="w-full bg-slate-800 text-white font-black py-4 rounded-[18px] hover:bg-slate-700 transition-all border border-white/10 shadow-lg">Volver al Inicio</button>
        </div>
      </div>
    );
  }

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
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#020617] font-outfit relative overflow-hidden">
        <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_0%,_#0f172a_0%,_#020617_100%)]"></div>
        <div className="relative z-10 w-full max-w-md bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[30px] p-8 md:p-12 shadow-[0_40px_100px_rgba(0,0,0,0.5)] flex flex-col items-center text-center animate-fade-in-up">
          <div className="w-16 h-16 bg-rose-500/20 text-rose-500 border border-rose-500/50 flex items-center justify-center rounded-full mb-6 shadow-[0_0_50px_rgba(244,63,94,0.3)]">
            <span className="material-symbols-outlined text-3xl">{surveyData?.__expired ? 'timer_off' : 'error'}</span>
          </div>
          <h2 className="text-2xl font-black text-white mb-2">{surveyData?.__expired ? 'Enlace Expirado' : 'Acceso No Disponible'}</h2>
          <p className="text-sm font-medium text-slate-400 mb-8 leading-relaxed">{surveyData?.__expired ? 'Este enlace de satisfacción ya no está vigente. Contacta al profesor si crees que es un error.' : error}</p>
          <button onClick={() => navigate('/')} className="w-full bg-slate-800 text-white font-black py-4 rounded-[18px] hover:bg-slate-700 transition-all border border-white/10 shadow-lg">Volver al Inicio</button>
        </div>
      </div>
    );
  }

  // Duplicate prevention: if this token was already used to respond
  if (surveyData && surveyData.respondida === true) {
    const userEmail = AuthAdapter.getUser()?.email || email || 'tu correo';
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 relative overflow-hidden font-outfit">
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden bg-[radial-gradient(circle_at_50%_0%,_#0f172a_0%,_#020617_100%)]">
          <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-900/20 rounded-full blur-[120px] opacity-40"></div>
        </div>
        <div className="relative z-10 w-full max-w-md bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[30px] p-10 md:p-12 shadow-[0_40px_100px_rgba(0,0,0,0.5)] animate-fade-in-up text-center flex flex-col items-center">
          <div className="w-20 h-20 rounded-full bg-rose-500/20 border border-rose-500/50 flex items-center justify-center mb-6 shadow-[0_0_50px_rgba(244,63,94,0.3)]">
            <span className="material-symbols-outlined text-rose-400 text-[42px]">error</span>
          </div>
          <h1 className="text-2xl font-black text-white px-2 mb-3 tracking-tight">Ya has respondido</h1>
          <p className="text-sm font-medium text-slate-400 leading-relaxed mb-8">
            Tu cuenta (<strong className="text-blue-300">{userEmail}</strong>) ya ha completado esta encuesta de satisfacción anteriormente. Solo se permite una respuesta por persona para garantizar resultados confiables.
          </p>
          <button 
            onClick={() => navigate('/')} 
            className="w-full bg-slate-800 text-white font-black py-4 rounded-[18px] hover:bg-slate-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2 uppercase tracking-widest text-xs border border-white/10"
          >
            <span className="material-symbols-outlined text-lg">home</span>
            Ir al Inicio
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (estrellas === 0 || nps === null || !aspecto) return;
    const success = await submit(
      {
        satisfaccion_estrellas: estrellas,
        nps: nps,
        aspecto_destacado: aspecto,
        comentario: comentario.trim() || null,
        respondida_en: new Date().toISOString()
      }
    );
    if (success) {
      if (urlSurveyId) {
        navigate(`/satisfaccion/success`, { replace: true });
      } else {
        navigate(`/satisfaccion/success`, { replace: true });
      }
    }
  };

  const isFormComplete = estrellas > 0 && nps !== null && aspecto !== '';

  return (
    <div className="min-h-screen bg-[#020617] flex flex-col items-center py-8 px-3 sm:py-10 sm:px-6 relative overflow-hidden">
      
      {/* Fondo estético tipo Celestial - idéntico al de Proyecto */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden bg-[radial-gradient(circle_at_50%_0%,_#0f172a_0%,_#020617_100%)]">
         <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-blue-600/20 rounded-full blur-[120px] opacity-60"></div>
         <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px] opacity-50"></div>
      </div>

      {/* Header Info - OUTSIDE the card, same as Proyecto */}
      <div className="w-full max-w-2xl text-center mb-6 relative z-10 px-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 mb-6">
          <span className="material-symbols-outlined text-white text-[28px]">rate_review</span>
        </div>
        <div className="flex items-center justify-center gap-2 text-blue-300 mb-2">
          <span className="material-symbols-outlined text-[16px]">star</span>
          <span className="text-[10px] font-black uppercase tracking-widest">Encuesta de Satisfacción</span>
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white mb-2 sm:mb-3 tracking-tight">Valoración de Actividad</h1>
        <p className="text-sm font-medium text-slate-400">
          Evaluando: <strong className="text-blue-300 ml-1">{surveyData?.surveys?.title || surveyData?.survey_title || 'Actividad Evaluada'}</strong>
        </p>
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

        <div className="p-5 sm:p-8 md:p-10">
        <form onSubmit={handleSubmit} className="space-y-10">
          
          {/* Pregunta 1: Estrellas (Reemplazado por Emojis) */}
          <div className="space-y-4">
            <label className="block text-sm font-bold text-white text-center">1. ¿Qué tan satisfecho/a estás con la actividad evaluada?</label>
            <div className="flex justify-center gap-1 sm:gap-3 md:gap-4 flex-wrap">
              {[
                { emoji: '😡', label: 'Pésimo', val: 1 },
                { emoji: '🙁', label: 'Malo', val: 2 },
                { emoji: '😐', label: 'Regular', val: 3 },
                { emoji: '🙂', label: 'Bueno', val: 4 },
                { emoji: '🤩', label: 'Excelente', val: 5 },
              ].map(({ emoji, label, val }) => {
                const isActive = estrellas === val;
                return (
                 <button
                   key={val}
                   type="button"
                   onClick={() => setEstrellas(val)}
                   className={`flex flex-col items-center gap-1.5 w-14 sm:w-16 md:w-20 py-3 rounded-3xl transition-all duration-300 transform ${
                     isActive 
                       ? 'bg-white/10 shadow-[0_0_30px_rgba(255,255,255,0.1)] scale-[1.15]' 
                       : 'bg-transparent hover:bg-white/5 hover:scale-110'
                   }`}
                 >
                   <span className={`text-[34px] sm:text-[40px] md:text-[50px] transition-all duration-300 ${!isActive && estrellas > 0 ? 'opacity-40 grayscale-[0.8]' : 'opacity-100'}`}>
                     {emoji}
                   </span>
                   <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wide leading-none transition-all duration-300 ${isActive ? 'text-white' : 'text-white/40'}`}>
                     {label}
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
                   className={`w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 text-xs sm:text-sm flex items-center justify-center border rounded-xl transition-all duration-300 ${
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
                  <ButtonLoader size={20} />
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
