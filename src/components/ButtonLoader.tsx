import React from 'react';

type ButtonLoaderProps = {
  size?: number | string;
  innerColor?: string;
  outerColor?: string;
  className?: string;
};

export default function ButtonLoader({
  size = 24,
  innerColor = '#93c5fd', // Por defecto celeste (blue-300)
  outerColor = '#ffffff', // Por defecto blanco
  className = ''
}: ButtonLoaderProps) {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 64 64" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle 
          cx="32" cy="32" r="13" 
          stroke={innerColor} strokeWidth="6" strokeLinecap="round" strokeDasharray="40.84 40.84" 
          style={{ animation: 'spinRight 1.6s ease-in-out infinite', transformOrigin: '50% 50%' }} 
        />
        <circle 
          cx="32" cy="32" r="23" 
          stroke={outerColor} strokeWidth="6" strokeLinecap="round" strokeDasharray="72.25 72.25" 
          style={{ animation: 'spinLeft 1.6s ease-in-out infinite', transformOrigin: '50% 50%' }} 
        />
      </svg>
      <style>{`
        @keyframes spinRight { 0% { transform: rotate(180deg); } 100% { transform: rotate(540deg); } }
        @keyframes spinLeft  { 0% { transform: rotate(180deg); } 100% { transform: rotate(-180deg); } }
      `}</style>
    </div>
  );
}
