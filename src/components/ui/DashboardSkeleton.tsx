import React from 'react';

/** Reutiliza la misma animación shimmer que SurveyCardSkeleton */
const shimmerStyle = `
  @keyframes shimmer { 100% { transform: translateX(100%); } }
`;

function Bone({ className = '' }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden bg-slate-200 dark:bg-slate-700/60 rounded-lg ${className}`}
      style={{ isolation: 'isolate' }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%)',
          transform: 'translateX(-100%)',
          animation: 'shimmer 1.5s infinite',
        }}
      />
    </div>
  );
}

/** Skeleton para las 3 stat-cards del "Resumen rápido" */
export function DashboardStatCardsSkeleton() {
  return (
    <>
      <style>{shimmerStyle}</style>
      <ul className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 w-full">
        {[0, 1, 2].map(i => (
          <li key={i} className="stat-card">
            {/* icono izquierdo */}
            <div className="stat-left" style={{ background: 'transparent' }}>
              <Bone className="w-9 h-9 rounded-xl" />
            </div>
            <div className="stat-body">
              {/* valor grande */}
              <Bone className="h-8 w-16 mb-2" />
              {/* label */}
              <Bone className="h-3.5 w-32" />
            </div>
            {/* badge */}
            <div className="stat-badge opacity-0">—</div>
            <div className="stat-subs flex flex-col gap-1.5 mt-1">
              <Bone className="h-3 w-36" />
              <Bone className="h-3 w-28" />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Skeleton para la lista de reportes / avisos */
export function DashboardNoticesSkeleton({ count = 3 }: { count?: number }) {
  return (
    <>
      <style>{shimmerStyle}</style>
      <div className="flex flex-col gap-2">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="notice-item notice-item--info pointer-events-none"
            style={{ opacity: 0.85 }}
          >
            {/* icono */}
            <div className="notice-item__icon notice-item__icon--info" style={{ background: 'transparent' }}>
              <Bone className="w-8 h-8 rounded-full" />
            </div>
            <div className="notice-item__body gap-2 flex flex-col">
              <Bone className="h-3.5 w-48" />
              <Bone className="h-3 w-64" />
              <Bone className="h-2.5 w-24 mt-1" />
            </div>
            {/* chevron placeholder */}
            <Bone className="w-3 h-5 rounded shrink-0 ml-auto" />
          </div>
        ))}
      </div>
    </>
  );
}
