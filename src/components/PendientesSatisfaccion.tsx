import React, { useEffect, useState } from 'react';
import { getPendingSatisfaccion } from '../services/satisfaccion.service';
import { useAuth } from '../services/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function PendientesSatisfaccion() {
  const { user } = useAuth();
  const [pendientes, setPendientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      if (user?.id) {
        const data = await getPendingSatisfaccion(user.id);
        setPendientes(data || []);
      }
      setLoading(false);
    }
    load();
  }, [user]);

  if (loading) return null; // Componente silencioso si está cargando

  if (pendientes.length === 0) return null;

  return (
    <div className="bg-white/80 backdrop-blur-xl border border-rose-100 rounded-[24px] p-6 shadow-xl shadow-rose-900/5 mb-8 animate-fade-in-up">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-rose-50 border border-rose-100 flex items-center justify-center rounded-xl text-rose-500">
          <span className="material-symbols-outlined text-xl">rate_review</span>
        </div>
        <div>
          <h3 className="font-black text-slate-800 leading-tight">Encuestas Pendientes</h3>
          <p className="text-xs font-semibold text-rose-500 uppercase tracking-widest">{pendientes.length} por responder</p>
        </div>
      </div>

      <div className="space-y-3 mt-6">
        {pendientes.map(p => (
          <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-slate-100 rounded-2xl bg-slate-50/50 hover:bg-white hover:border-slate-200 transition-all">
            <div>
              <p className="font-bold text-slate-800 text-sm line-clamp-1">{p.surveys?.title || 'Actividad Desconocida'}</p>
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mt-1">
                Expira: {new Date(p.token_expires_at).toLocaleDateString()}
              </p>
            </div>
            <button 
              onClick={() => navigate(`/satisfaccion/${p.token}`)}
              className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-colors shadow-sm"
            >
              Evaluar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
