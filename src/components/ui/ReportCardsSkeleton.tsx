import React from 'react';

const shimmerStyle = `@keyframes shimmer { 100% { transform: translateX(100%); } }`;

function Bone({ className = '' }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden bg-slate-200 dark:bg-slate-700/60 rounded-lg ${className}`}
    >
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)',
        transform: 'translateX(-100%)',
        animation: 'shimmer 1.5s infinite',
      }} />
    </div>
  );
}

/**
 * Skeleton premium para la grid de tarjetas de Reportes.
 * Imita: acento de color superior, icono + badge, título dos líneas, footer con respuestas + botón.
 */
export function ReportCardsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <>
      <style>{shimmerStyle}</style>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl border border-slate-100 flex flex-col relative overflow-hidden shadow-sm"
          >
            <div className={`absolute top-0 left-0 right-0 h-[5px] ${i % 2 === 0 ? 'bg-indigo-400' : 'bg-emerald-400'}`} />
            <div className="p-5 md:p-6 flex-1 flex flex-col">
              {/* Icono + badge */}
              <div className="flex items-start justify-between gap-3 mb-5 mt-1">
                <Bone className="w-10 h-10 rounded-xl shrink-0" />
                <Bone className="h-5 w-20 rounded-full" />
              </div>

              {/* Título */}
              <Bone className="h-5 w-11/12 mb-2" />
              <Bone className="h-5 w-2/3 mb-6" />

              {/* Footer: respuestas */}
              <div className="mt-auto pt-4 border-t border-slate-50 flex items-center gap-2">
                <Bone className="w-4 h-4 rounded" />
                <Bone className="h-4 w-8" />
                <Bone className="h-3.5 w-20" />
              </div>
            </div>

            {/* Botón CTA */}
            <div className="p-2 bg-slate-50/80 border-t border-slate-100">
              <Bone className="h-10 w-full rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
