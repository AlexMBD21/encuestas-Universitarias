import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function SatisfaccionSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const surveyId = searchParams.get('surveyId');

  return (
    <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 relative overflow-hidden font-outfit">
      
      {/* Fondo estético tipo Celestial */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden bg-[radial-gradient(circle_at_50%_0%,_#0f172a_0%,_#020617_100%)]">
         <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-emerald-600/20 rounded-full blur-[120px] opacity-60"></div>
      </div>

      <div className="relative z-10 w-full max-w-md bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[30px] p-10 md:p-12 shadow-[0_40px_100px_rgba(0,0,0,0.5)] animate-fade-in-up text-center flex flex-col items-center">
        
        <div className="w-24 h-24 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center mb-8 shadow-[0_0_50px_rgba(16,185,129,0.3)]">
          <span className="material-symbols-outlined text-emerald-400 text-[50px]">task_alt</span>
        </div>

        <h1 className="text-3xl font-black text-white px-2 mb-4 tracking-tight">¡Muchas gracias!</h1>
        
        <p className="text-sm font-medium text-slate-400 leading-relaxed mb-10">
          Tu opinión ha sido registrada correctamente. Agradecemos el tiempo que te tomaste para darnos tu retroalimentación; es invaluable para la mejora continua.
        </p>

        <button 
          onClick={() => navigate('/')} 
          className="w-full bg-slate-800 text-white font-black py-4 rounded-[18px] hover:bg-slate-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2 uppercase tracking-widest text-xs border border-white/10"
        >
          <span className="material-symbols-outlined text-lg">home</span>
          Finalizar
        </button>
        
      </div>
    </div>
  );
}
