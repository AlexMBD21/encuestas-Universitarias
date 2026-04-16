import React from 'react';

type LoaderProps = {
  text?: string | null;
  size?: number | string;
  className?: string;
  fullScreen?: boolean;
  innerColor?: string;
  outerColor?: string;
};

export default function Loader({ 
  text = 'Cargando...', 
  size = 80, 
  className = '', 
  fullScreen = false,
  innerColor = '#3b82f6',
  outerColor = '#0f172a'
}: LoaderProps) {
  const content = (
    <div className={`flex flex-col items-center justify-center gap-6 ${className}`}>
      <div className="relative flex items-center justify-center">
        <svg 
          width={size} 
          height={size} 
          viewBox="0 0 64 64" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Arco interior: gira a la derecha (cian/sky blue por defecto) */}
          <circle cx="32" cy="32" r="13" stroke={innerColor} strokeWidth="6" strokeLinecap="round" strokeDasharray="40.84 40.84" style={{ animation: 'spinRight 1.6s ease-in-out infinite', transformOrigin: '50% 50%' }} />
          {/* Arco exterior: gira a la izquierda (azul topbar por defecto) */}
          <circle cx="32" cy="32" r="23" stroke={outerColor} strokeWidth="6" strokeLinecap="round" strokeDasharray="72.25 72.25" style={{ animation: 'spinLeft 1.6s ease-in-out infinite', transformOrigin: '50% 50%' }} />
        </svg>
        <style>{`
          @keyframes spinRight { 0% { transform: rotate(180deg); } 100% { transform: rotate(540deg); } }
          @keyframes spinLeft  { 0% { transform: rotate(180deg); } 100% { transform: rotate(-180deg); } }
        `}</style>
      </div>
      {text && (
        <div className="text-sm font-black uppercase tracking-[0.3em] animate-pulse" style={{ color: outerColor }}>
          {text}
        </div>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur-sm overflow-hidden">
        {content}
      </div>
    );
  }

  return content;
}
