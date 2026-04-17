import React from 'react';

/** Shimmer overlay que recorre la tarjeta de izquierda a derecha */
const shimmer = `
  relative overflow-hidden
  before:absolute before:inset-0
  before:-translate-x-full
  before:animate-[shimmer_1.5s_infinite]
  before:bg-gradient-to-r
  before:from-transparent before:via-white/60 dark:before:via-white/10 before:to-transparent
`;

function Bone({ className = '' }: { className?: string }) {
  return (
    <div className={`${shimmer} bg-slate-200 dark:bg-slate-700/60 rounded-lg ${className}`} />
  );
}

export function SurveyCardSkeleton({ variant = 'project' }: { variant?: 'project' | 'simple' }) {
  const accentColor = variant === 'project'
    ? 'bg-indigo-100'
    : 'bg-emerald-100';

  return (
    <div className="relative p-5 border border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 flex flex-col justify-between overflow-hidden shadow-sm">
      <div className={`absolute top-0 left-0 w-full h-[5px] ${accentColor}`} />

      <div className="flex-1 mt-1">
        {/* Badges */}
        <div className="flex gap-1.5 mb-3 mt-0.5">
          <Bone className="h-5 w-20 rounded-full" />
          <Bone className="h-5 w-16 rounded-full" />
        </div>

        {/* Título */}
        <Bone className="h-5 w-11/12 mb-2" />
        <Bone className="h-4 w-7/12 mb-1" />

        {/* Propietario */}
        <Bone className="h-3 w-1/2 mt-3" />

        {/* Divider + detalles */}
        <div className="border-t border-slate-100 dark:border-slate-800 mt-4 pt-4 flex flex-col gap-2.5">
          <Bone className="h-3 w-2/3" />
          <Bone className="h-3 w-1/3" />
        </div>

        {/* Barra de progreso (solo proyecto) */}
        {variant === 'project' && (
          <div className="mt-3 rounded-lg border border-slate-100 dark:border-slate-800 p-2.5">
            <div className="flex justify-between mb-2">
              <Bone className="h-3 w-1/2" />
              <Bone className="h-3 w-10" />
            </div>
            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className={`${shimmer} h-1.5 w-1/3 bg-indigo-200 rounded-full`} />
            </div>
          </div>
        )}
      </div>

      {/* Botonera */}
      <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end items-center gap-2">
        <Bone className="h-8 w-28 rounded-xl" />
      </div>
    </div>
  );
}

/** Grid completo de skeletons mientras se cargan las encuestas */
export function SurveyGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <>
      <style>{`
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}</style>
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }).map((_, i) => (
          <SurveyCardSkeleton key={i} variant={i % 3 === 0 ? 'project' : 'simple'} />
        ))}
      </div>
    </>
  );
}
