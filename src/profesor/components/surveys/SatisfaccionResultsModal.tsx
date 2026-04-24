import React, { useEffect, useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { getSatisfaccionResultsBySurveyId } from '../../../services/satisfaccion.service';
import Loader from '../../../components/Loader';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  surveyId: string;
  surveyTitle?: string;
};

export function SatisfaccionResultsModal({ isOpen, onClose, surveyId, surveyTitle }: Props) {
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<any | null>(null);

  useEffect(() => {
    if (!isOpen || !surveyId) return;
    let mounted = true;
    setLoading(true);
    getSatisfaccionResultsBySurveyId(surveyId).then(data => {
      if (mounted) { setResults(data); setLoading(false); }
    }).catch(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [isOpen, surveyId]);

  const EMOJIS = ['😡', '🙁', '😐', '🙂', '🤩'];
  const EMOJI_LABELS = ['Muy insatisfecho', 'Insatisfecho', 'Neutral', 'Satisfecho', 'Muy satisfecho'];

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-2xl" hideMobileIndicator={true}>
      <div className="bg-white dark:bg-slate-900 rounded-t-[2rem] sm:rounded-2xl flex flex-col h-full sm:max-h-[85vh] relative overflow-hidden">
        {/* Drag handle mobile */}
        <div className="w-full flex justify-center pt-2 pb-1 sm:hidden absolute top-0 z-20 cursor-pointer" style={{ touchAction: 'none' }} onClick={onClose}>
          <div className="w-12 h-1.5 rounded-full bg-slate-900/40 dark:bg-white/30"></div>
        </div>

        {/* Header */}
        <div className="shrink-0 px-6 pt-6 sm:pt-8 pb-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex items-center justify-between mt-4 sm:mt-0 pr-10">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm shrink-0">
                <span className="material-symbols-outlined text-[26px]">rate_review</span>
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 truncate">Resultados de Satisfacción</h3>
                {surveyTitle && <p className="text-xs font-medium text-slate-400 truncate">{surveyTitle}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar-sm">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader size={48} text="Cargando métricas..." /></div>
          ) : !results || results.respondidas === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-full flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-3xl">inbox</span>
              </div>
              <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-1">Sin calificaciones aún</h4>
              <p className="text-sm text-slate-500 max-w-sm">Aún no se han recibido respuestas de satisfacción. Comparte el enlace para empezar a recibir datos.</p>
              {results && results.total > 0 && (
                <p className="text-xs text-slate-400 mt-3">{results.total} persona{results.total !== 1 ? 's' : ''} registrada{results.total !== 1 ? 's' : ''}, 0 respuestas</p>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* Counter Banner */}
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-800/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                  <span className="material-symbols-outlined text-[28px]">groups</span>
                </div>
                <div>
                  <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{results.respondidas} <span className="text-sm font-bold text-emerald-500">/ {results.total}</span></div>
                  <p className="text-xs font-medium text-emerald-600/70 dark:text-emerald-400/70">respuestas recibidas</p>
                </div>
              </div>

              {/* Stars Summary */}
              <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-[18px] text-amber-500">star</span>
                  <h4 className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Satisfacción General</h4>
                </div>
                <div className="flex items-center gap-6 mb-4">
                  <div className="text-center">
                    <div className="text-4xl font-black text-slate-800 dark:text-slate-100">{results.estrellas.promedio}</div>
                    <div className="text-xs text-slate-400 font-bold">/ 5.00</div>
                  </div>
                  <div className="flex gap-1">
                    {EMOJIS.map((emoji, i) => {
                      const val = i + 1;
                      const isActive = val <= Math.round(results.estrellas.promedio);
                      return (
                        <span key={i} className={`text-3xl transition-all ${isActive ? 'opacity-100' : 'opacity-20 grayscale'}`}>{emoji}</span>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-2">
                  {EMOJIS.map((emoji, i) => {
                    const count = results.estrellas.distribucion[i] || 0;
                    const pct = results.respondidas > 0 ? Math.round((count / results.respondidas) * 100) : 0;
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-lg w-8 text-center shrink-0">{emoji}</span>
                        <div className="flex-1 h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-amber-400 transition-all duration-700" style={{ width: `${pct}%` }}></div>
                        </div>
                        <span className="text-xs font-bold text-slate-500 w-12 text-right tabular-nums">{count} ({pct}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* NPS */}
              <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-[18px] text-blue-500">speed</span>
                  <h4 className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Net Promoter Score (NPS)</h4>
                </div>
                <div className="flex items-center gap-6 mb-5">
                  <div className={`text-5xl font-black tabular-nums ${results.nps.score > 0 ? 'text-emerald-600' : results.nps.score < 0 ? 'text-rose-600' : 'text-slate-600'}`}>
                    {results.nps.score > 0 ? '+' : ''}{results.nps.score}
                  </div>
                  <div className="text-xs text-slate-400 font-medium leading-relaxed">
                    {results.nps.score >= 50 ? 'Excelente' : results.nps.score >= 0 ? 'Bueno' : 'Necesita mejorar'}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/50 rounded-xl p-3 text-center">
                    <div className="text-lg font-black text-rose-600 dark:text-rose-400">{results.nps.detractores}</div>
                    <div className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Detractores</div>
                    <div className="text-[10px] text-rose-400">(1-6)</div>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-3 text-center">
                    <div className="text-lg font-black text-amber-600 dark:text-amber-400">{results.nps.neutrales}</div>
                    <div className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Neutrales</div>
                    <div className="text-[10px] text-amber-400">(7-8)</div>
                  </div>
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-3 text-center">
                    <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">{results.nps.promotores}</div>
                    <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Promotores</div>
                    <div className="text-[10px] text-emerald-400">(9-10)</div>
                  </div>
                </div>
              </div>

              {/* Aspectos */}
              {Object.keys(results.aspectos).length > 0 && (
                <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-[18px] text-indigo-500">insights</span>
                    <h4 className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Aspectos Destacados</h4>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(results.aspectos)
                      .sort(([, a]: any, [, b]: any) => b - a)
                      .map(([aspecto, count]: [string, any]) => {
                        const pct = results.respondidas > 0 ? Math.round((count / results.respondidas) * 100) : 0;
                        return (
                          <div key={aspecto} className="flex items-center gap-3">
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 w-36 truncate shrink-0" title={aspecto}>{aspecto}</span>
                            <div className="flex-1 h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-indigo-400 transition-all duration-700" style={{ width: `${pct}%` }}></div>
                            </div>
                            <span className="text-xs font-bold text-slate-500 w-12 text-right tabular-nums">{count} ({pct}%)</span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Comentarios */}
              {results.comentarios.length > 0 && (
                <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-[18px] text-slate-500">chat_bubble</span>
                    <h4 className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Comentarios</h4>
                    <span className="text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-500 px-2 py-0.5 rounded-md">{results.comentarios.length}</span>
                  </div>
                  <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar-sm">
                    {results.comentarios.map((c: string, i: number) => (
                      <div key={i} className="p-3.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-300 flex gap-3 items-start">
                        <span className="material-symbols-outlined text-[16px] text-slate-400 mt-0.5 shrink-0">format_quote</span>
                        <div className="leading-relaxed">{c}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Respondentes List */}
              {results.respondentes.length > 0 && (
                <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-[18px] text-slate-500">list</span>
                    <h4 className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Detalle por Persona</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-700">
                          <th className="py-2 px-2 text-[10px] font-black uppercase tracking-wider text-slate-400">Correo</th>
                          <th className="py-2 px-2 text-[10px] font-black uppercase tracking-wider text-slate-400 text-center">Satisf.</th>
                          <th className="py-2 px-2 text-[10px] font-black uppercase tracking-wider text-slate-400 text-center">NPS</th>
                          <th className="py-2 px-2 text-[10px] font-black uppercase tracking-wider text-slate-400">Aspecto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.respondentes.map((r: any, i: number) => (
                          <tr key={i} className="border-b border-slate-50 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="py-2.5 px-2 text-xs font-medium text-slate-600 dark:text-slate-300 truncate max-w-[160px]" title={r.email}>{r.email}</td>
                            <td className="py-2.5 px-2 text-center">
                              <span className="text-lg">{EMOJIS[r.estrellas - 1] || '—'}</span>
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <span className={`text-xs font-black px-2 py-0.5 rounded-md ${r.nps <= 6 ? 'bg-rose-100 text-rose-700' : r.nps <= 8 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{r.nps}</span>
                            </td>
                            <td className="py-2.5 px-2 text-xs text-slate-500 truncate max-w-[120px]" title={r.aspecto}>{r.aspecto}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-end">
          {/* Redundant button removed in favor of Modal's premium close button */}
        </div>
      </div>
    </Modal>
  );
}
