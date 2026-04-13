import React, { forwardRef } from 'react';
import { PrintConfig } from './PrintConfigModal';

interface PrintLayoutProps {
  report: any;
  config: PrintConfig | null;
  usersCache: Record<string, any>;
}

const PrintLayout = forwardRef<HTMLDivElement, PrintLayoutProps>(({ report, config, usersCache }, ref) => {
  if (!report || !config) return <div ref={ref} />;

  const survey = report.survey || {};
  const isProject = survey.type === 'project';
  const exportDate = new Date().toLocaleString('es', { dateStyle: 'long', timeStyle: 'short' });

  const resolveUser = (uid: string) => {
    if (!uid || uid === 'anónimo') return 'Anónimo';
    if (usersCache && usersCache[uid]) {
      const u = usersCache[uid];
      return u.email || u.name || u.displayName || uid;
    }
    return uid;
  };

  // Pre-process Ranking Data
  let visibleSummaries = report.projectSummaries || [];
  if (isProject && config.includeRanking) {
    if (config.categoryFilter !== 'Todas') {
      visibleSummaries = visibleSummaries.filter((ps: any) => {
        const cat = (ps.project?.category || 'Sin Categoría').trim();
        return cat === config.categoryFilter;
      });
    }

    if (config.showOnlyWinners) {
       // Need to find max score per category
       const catMaxScore: Record<string, number> = {};
       report.projectSummaries.forEach((ps: any) => {
          const cat = (ps.project?.category || 'Sin Categoría').trim();
          if (ps.overall !== null && (catMaxScore[cat] === undefined || ps.overall > catMaxScore[cat])) {
             catMaxScore[cat] = ps.overall;
          }
       });
       visibleSummaries = visibleSummaries.filter((ps: any) => {
          const cat = (ps.project?.category || 'Sin Categoría').trim();
          return ps.overall !== null && ps.overall === catMaxScore[cat] && catMaxScore[cat] > -1;
       });
    }

    // Sort by overall
    visibleSummaries.sort((a: any, b: any) => {
      const aScore = a.overall !== null ? a.overall : -1;
      const bScore = b.overall !== null ? b.overall : -1;
      return bScore - aScore;
    });
  }

  const toPercent = (v: number | null) => {
    if (v === null || v === undefined) return 0;
    return Math.max(0, Math.min(100, Math.round(((Number(v) - 1) / 4) * 100)));
  };

  const hasRanking = isProject && config.includeRanking && visibleSummaries.length > 0;
  const hasStats = config.includeStats && !!report.questionStats;
  const hasComments = isProject && config.includeComments && visibleSummaries.length > 0 && visibleSummaries.some((ps: any) => ps.criteria.some((c: any) => c.texts && c.texts.length > 0));

  const SectionDivider = () => (
    <div className="flex items-center justify-center pt-4 pb-8 opacity-60 avoid-break w-full">
      <div className="flex gap-2 items-center">
         <div className="h-[2px] w-12 rounded-full bg-slate-200"></div>
         <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
         <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
         <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
         <div className="h-[2px] w-12 rounded-full bg-slate-200"></div>
      </div>
    </div>
  );

  return (
    <div ref={ref} className="bg-white text-slate-900 mx-auto w-full font-sans print:p-[12mm]" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
      <style>{`
        @page { margin: 0; size: auto; }
        @media print {
          html, body { background: white; margin: 0; padding: 0; }
          .page-break-before { page-break-before: always; }
          .avoid-break { page-break-inside: avoid; break-inside: avoid; }
        }
      `}</style>

      {/* ── Header ── */}
      <div className="bg-slate-50 rounded-3xl p-8 mb-6 avoid-break relative overflow-hidden border border-slate-200 shadow-sm">
        <div className="absolute top-1/2 right-12 -translate-y-1/2 text-slate-200/50">
           <svg width="160" height="160" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5C3.89 3 3 3.9 3 5V19C3 20.1 3.89 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM19 19H5V5H19V19ZM11 7H13V9H11V7ZM11 11H13V17H11V11Z"/></svg>
        </div>
        <div className="relative z-10 max-w-4xl">
           <h1 className="text-4xl font-black tracking-tight leading-tight break-words text-slate-800">{survey.title || 'Reporte de Encuesta'}</h1>
           {survey.description && <p className="text-slate-500 mt-4 text-base break-words leading-relaxed max-w-3xl">{survey.description}</p>}
           <div className="flex flex-wrap gap-4 mt-8">
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 shadow-sm">
                 <span className="text-[16px] leading-none">📋</span> {report.totalResponses} Respuestas
              </div>
              {isProject && (
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 shadow-sm">
                   <span className="text-[16px] leading-none">🏆</span> {report.projectSummaries?.length || 0} Proyectos
                </div>
              )}
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 shadow-sm">
                 <span className="text-[16px] leading-none">📅</span> {exportDate}
              </div>
           </div>
        </div>
      </div>

      {/* ── Ranking (Project Only) ── */}
      {isProject && config.includeRanking && visibleSummaries.length > 0 && (
        <div className="mb-6">
          <SectionDivider />
          <h2 className="text-2xl font-black text-slate-900 border-b-2 border-indigo-100 pb-3 mb-4">Ranking de Proyectos</h2>
          <div className="space-y-4">
            {visibleSummaries.map((ps: any, idx: number) => {
              const pct = toPercent(ps.overall);
              let badgeTheme = {
                stripe: 'bg-slate-300',
                medalText: 'text-slate-400',
                scoreText: 'text-slate-600',
                barSrc: 'from-slate-300 to-slate-400',
                icon: ''
              };

              if (idx === 0) {
                badgeTheme = { stripe: 'bg-amber-500', medalText: 'text-amber-600', scoreText: 'text-amber-600', barSrc: 'from-amber-400 to-amber-500', icon: '🥇' };
              } else if (idx === 1) {
                badgeTheme = { stripe: 'bg-slate-400', medalText: 'text-slate-500', scoreText: 'text-slate-500', barSrc: 'from-slate-300 to-slate-400', icon: '🥈' };
              } else if (idx === 2) {
                badgeTheme = { stripe: 'bg-orange-600', medalText: 'text-orange-700', scoreText: 'text-orange-700', barSrc: 'from-orange-500 to-orange-600', icon: '🥉' };
              }
              
              return (
                <div key={idx} className="border border-slate-200 bg-white rounded-xl p-3.5 flex gap-4 items-center avoid-break shadow-sm relative overflow-hidden">
                   <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${badgeTheme.stripe}`}></div>
                   <div className="flex flex-col items-center justify-center shrink-0 w-14">
                      {badgeTheme.icon && <span className="text-2xl leading-none mb-1">{badgeTheme.icon}</span>}
                      <span className={`font-black text-xl ${badgeTheme.medalText}`}>#{idx + 1}</span>
                   </div>
                   <div className="flex-1 min-w-0">
                     <h3 className="font-bold text-slate-900 text-lg leading-tight break-all whitespace-normal pr-2">{ps.project?.name || 'Sin nombre'}</h3>
                     <p className="text-xs text-slate-500 font-bold uppercase tracking-wide mt-1.5 line-clamp-1">{ps.project?.category || 'Sin Categoría'}</p>
                   </div>
                   <div className="text-right shrink-0 w-32">
                     <div className="flex justify-end items-end mb-1.5 gap-2">
                       <span className={`font-black text-2xl leading-none ${badgeTheme.scoreText}`}>{ps.overall?.toFixed(2) || 'N/A'}</span>
                       <span className="text-xs text-slate-400 font-bold mb-0.5">{pct}%</span>
                     </div>
                     <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                       <div className={`h-full bg-gradient-to-r rounded-full ${badgeTheme.barSrc}`} style={{ width: `${pct}%` }} />
                     </div>
                     <div className="text-[10px] text-slate-400 mt-1.5 uppercase font-semibold">{ps.responses} evals</div>
                   </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Question Stats ── */}
      {config.includeStats && report.questionStats && (
        <div className="mb-6">
          <SectionDivider />
          <h2 className="text-2xl font-black text-slate-900 border-b-2 border-indigo-100 pb-3 mb-4">Estadísticas de Preguntas</h2>
          <div className="grid grid-cols-1 gap-6">
            {report.questionStats.map((qs: any, qi: number) => {
              const isText = qs.questionType === 'text';
              
              if (isText && !config.includeComments) return null;

              return (
                <div key={qi} className="avoid-break border border-slate-200 rounded-2xl p-6 bg-slate-50/50">
                  <div className="flex gap-4 items-start mb-5">
                    <span className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-black shrink-0 shadow-sm mt-0.5">
                      {qi + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-800 text-[16px] leading-snug break-all whitespace-normal pr-4">{qs.question}</h3>
                      <div className="flex gap-3 mt-2">
                         <span className="bg-white border border-slate-200 text-slate-600 text-[10px] uppercase font-bold px-2 py-0.5 rounded-md shadow-sm">
                           {isText ? 'Abierta' : 'Opción Múltiple'}
                         </span>
                         <span className="text-xs text-slate-500 font-semibold py-0.5 bg-white border border-slate-200 px-2 rounded-md shadow-sm">{qs.answered} respuestas</span>
                      </div>
                    </div>
                  </div>

                  {isText ? (
                    <div className="space-y-2 mt-3 ml-12">
                      {(!qs.texts || qs.texts.length === 0) ? (
                        <p className="text-[11px] italic text-slate-400">Sin comentarios registrados</p>
                      ) : (
                        qs.texts.map((t: string, i: number) => (
                          <div key={i} className="flex items-start gap-2">
                            <span className="text-indigo-300 font-serif text-lg leading-none mt-0.5">"</span>
                            <p className="text-[12px] text-slate-700 leading-snug break-words italic">{t}</p>
                          </div>
                        ))
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3 mt-4 ml-12 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                      {(qs.options && qs.options.length > 0 ? qs.options : Object.keys(qs.counts)).map((opt: string, i: number) => {
                        const cnt = qs.counts[opt] || 0;
                        const pct = qs.answered > 0 ? Math.round((cnt / qs.answered) * 100) : 0;
                        return (
                          <div key={i} className="flex items-center gap-4 text-[13px]">
                            <div className="w-1/3 min-w-[120px] font-semibold text-slate-700 break-words leading-tight">{opt}</div>
                            <div className="flex-1 shrink-0 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <div className="w-16 shrink-0 text-right font-black text-slate-800">{pct}% <span className="text-slate-400 font-semibold ml-1 text-[10px]">({cnt})</span></div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Comentarios de Proyectos ── */}
      {hasComments && (
         <div className="mb-6">
            <SectionDivider />
            <h2 className="text-2xl font-black text-slate-900 border-b-2 border-indigo-100 pb-3 mb-4">Anexo de Comentarios (Proyectos)</h2>
            <div className="space-y-4">
              {visibleSummaries.map((ps: any, idx: number) => {
                 const allTexts = ps.criteria.flatMap((c: any) => c.texts || []);
                 if (allTexts.length === 0) return null;
                 return (
                    <div key={idx} className="avoid-break bg-white border border-slate-200/60 rounded-xl p-4 shadow-sm">
                       <h3 className="font-bold text-slate-900 text-sm mb-3 pb-1 border-b border-slate-100 break-all whitespace-normal">{ps.project.name}</h3>
                       <div className="space-y-2">
                          {allTexts.map((txt: string, i: number) => (
                             <div key={i} className="flex gap-2 items-start">
                                <div className="w-1.5 h-1.5 mt-[7px] rounded-full bg-indigo-200 shrink-0"></div>
                                <p className="text-[12px] text-slate-700 leading-relaxed italic break-words flex-1">"{txt}"</p>
                             </div>
                          ))}
                       </div>
                    </div>
                 );
              })}
            </div>
         </div>
      )}

      {/* ── Raw Responses Table ── */}
      {(() => {
        if (!config.includeRawResponses) return null;
        let rawTableRows = report.rows || [];
        if (isProject && report.rawResponses && visibleSummaries.length > 0) {
          const visibleProjectIds = new Set(visibleSummaries.map((ps: any) => String(ps.project.id)));
          const filteredRaw = report.rawResponses.filter((r: any) => visibleProjectIds.has(String(r.projectId)));
          rawTableRows = filteredRaw.map((r: any) => {
            const proj = visibleSummaries.find((ps: any) => String(ps.project.id) === String(r.projectId));
            const row: any = { userId: r.userId, submittedAt: r.submittedAt, Proyecto: proj ? proj.project.name : r.projectId };
            const answers = r.answers || {};
            const rubric = report.rubric || [];
            rubric.forEach((crit: any) => {
               const qid = crit.id || crit.text;
               const valRaw = answers[qid] !== undefined ? answers[qid] : answers[crit.text];
               const comment = answers[`${qid}_comment`] || answers[`${crit.text}_comment`];
               let finalVal = valRaw !== undefined && valRaw !== null && String(valRaw).trim() !== '' ? String(valRaw) : '';
               if (comment) finalVal += (finalVal ? '\n\n' : '') + `💬 ${comment}`;
               row[crit.text || qid] = finalVal || '—';
            });
            return row;
          });
        }
        if (!rawTableRows || rawTableRows.length === 0) return null;

        return (
          <div className="mb-6">
            <SectionDivider />
            <h2 className="text-2xl font-black text-slate-900 border-b-2 border-indigo-100 pb-3 mb-4">Respuestas Crudas</h2>
            <div className="w-full overflow-hidden border border-slate-200/80 rounded-3xl bg-white shadow-lg shadow-slate-200/40">
              <table className="w-full text-left text-[11px] leading-relaxed">
                <thead className="bg-gradient-to-r from-indigo-50 to-slate-50 border-b-2 border-indigo-100">
                  <tr>
                    <th className="px-5 py-4 font-black uppercase tracking-widest text-indigo-900 border-r border-indigo-100/50 bg-white/50">Usuario</th>
                    <th className="px-4 py-4 font-black uppercase tracking-widest text-indigo-900 border-r border-indigo-100/50 bg-white/50">Fecha</th>
                    {Object.keys(rawTableRows[0])
                      .filter((k) => k !== 'userId' && k !== 'submittedAt' && k !== 'projectId' && k !== 'projectName' && k !== 'responses' && k !== 'overall')
                      .map((k, i) => (
                        <th key={i} className="px-4 py-4 font-bold break-all whitespace-normal align-bottom text-slate-700" style={{ maxWidth: '140px' }} title={k}>{k}</th>
                      ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rawTableRows.map((r: any, rIdx: number) => (
                    <tr key={rIdx} className={`avoid-break hover:bg-indigo-50/50 transition-colors ${rIdx % 2 !== 0 ? 'bg-slate-50/30' : 'bg-white'}`}>
                      <td className="px-5 py-4 font-black text-indigo-600 break-all whitespace-normal max-w-[120px] align-top bg-white/30 border-r border-slate-100/50">{resolveUser(r.userId)}</td>
                      <td className="px-4 py-4 text-slate-400 font-bold whitespace-nowrap align-top bg-white/30 border-r border-slate-100/50 tracking-wide text-[10px] uppercase">
                        {r.submittedAt ? new Date(r.submittedAt).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                      </td>
                      {Object.keys(r)
                        .filter((k) => k !== 'userId' && k !== 'submittedAt' && k !== 'projectId' && k !== 'projectName' && k !== 'responses' && k !== 'overall')
                        .map((k, i) => (
                          <td key={i} className="px-4 py-4 text-slate-700 align-top">
                            <div className="overflow-hidden break-words whitespace-pre-wrap max-h-[120px] font-medium leading-relaxed" style={{ minWidth: '80px', maxWidth: '250px' }}>
                              {String(r[k] === undefined || r[k] === null || r[k] === '' ? '—' : r[k])}
                            </div>
                          </td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}
      
      {/* ── Footer ── */}
      <div className="mt-12 pt-6 border-t border-slate-200 text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest avoid-break">
        Documento generado el {exportDate} · {survey.title}
      </div>

    </div>
  );
});

export default PrintLayout;
