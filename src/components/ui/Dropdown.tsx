import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';

export interface DropdownOption {
  id: string;
  label: string;
  color?: 'blue' | 'indigo' | 'emerald' | 'red' | 'slate';
  icon?: string;
}

export interface DropdownProps {
  value: string;
  label: string;
  options: DropdownOption[];
  onChange: (val: string) => void;
  icon?: string;
  color?: 'blue' | 'indigo' | 'emerald' | 'red' | 'slate';
}

const THEME_MAP = {
  blue: {
    border: 'border-blue-500',
    ring: 'ring-blue-500/10',
    icon: 'text-blue-600',
    bgSelected: 'bg-blue-50',
    textSelected: 'text-blue-700',
    hoverBg: 'hover:bg-blue-50/50',
    hoverText: 'hover:text-blue-600'
  },
  indigo: {
    border: 'border-indigo-500',
    ring: 'ring-indigo-500/10',
    icon: 'text-indigo-600',
    bgSelected: 'bg-indigo-50',
    textSelected: 'text-indigo-700',
    hoverBg: 'hover:bg-indigo-50/50',
    hoverText: 'hover:text-indigo-600'
  },
  emerald: {
    border: 'border-emerald-500',
    ring: 'ring-emerald-500/10',
    icon: 'text-emerald-600',
    bgSelected: 'bg-emerald-50',
    textSelected: 'text-emerald-700',
    hoverBg: 'hover:bg-emerald-50/50',
    hoverText: 'hover:text-emerald-600'
  },
  red: {
    border: 'border-red-500',
    ring: 'ring-red-500/10',
    icon: 'text-red-600',
    bgSelected: 'bg-red-50',
    textSelected: 'text-red-700',
    hoverBg: 'hover:bg-red-50/50',
    hoverText: 'hover:text-red-600'
  },
  slate: {
    border: 'border-slate-400',
    ring: 'ring-slate-500/10',
    icon: 'text-slate-800',
    bgSelected: 'bg-slate-100',
    textSelected: 'text-slate-900',
    hoverBg: 'hover:bg-slate-50',
    hoverText: 'hover:text-slate-800'
  }
};

export function Dropdown({ value, label, options, onChange, icon = 'expand_more', color = 'slate' }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const updatePosition = () => {
      if (buttonRef.current) setRect(buttonRef.current.getBoundingClientRect());
    };
    updatePosition();
    
    const handleScroll = (e: Event) => {
      const target = e.target as Node;
      // No cerrar si el scroll ocurre dentro del propio menú desplegable
      if (target && target instanceof Element && target.closest('.portal-dropdown-menu')) {
         return;
      }
      setIsOpen(false);
    };

    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', updatePosition);
    
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        const menus = document.querySelectorAll('.portal-dropdown-menu');
        for (const m of Array.from(menus)) {
          if (m.contains(event.target as Node)) return;
        }
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', updatePosition);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const selectedOption = options.find(o => String(o.id) === String(value));
  const displayLabel = selectedOption ? selectedOption.label : label;
  const activeColor = selectedOption?.color || color;
  const activeIcon = selectedOption?.icon || icon;
  const currentTheme = THEME_MAP[activeColor] || THEME_MAP.slate;

  return (
    <div ref={containerRef} className="relative shrink-0 w-full md:w-auto">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (!isOpen && buttonRef.current) setRect(buttonRef.current.getBoundingClientRect());
          setIsOpen(!isOpen);
        }}
        className={`w-full bg-slate-50 border ${isOpen ? `${currentTheme.border} ring-4 ${currentTheme.ring}` : 'border-slate-200'} text-slate-700 text-sm font-bold rounded-xl hover:border-slate-300 transition-all outline-none cursor-pointer active:scale-[0.98] shadow-sm`}
        style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: '10px', padding: '10px 16px', textAlign: 'left' }}
      >
        <span className={`material-symbols-outlined text-[18px] ${currentTheme.icon} shrink-0`}>{activeIcon}</span>
        <span className="truncate">{displayLabel}</span>
        <span className={`material-symbols-outlined text-slate-400 text-[18px] transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`}>expand_more</span>
      </button>

      {isOpen && rect && ReactDOM.createPortal(
        <div 
          className="portal-dropdown-menu fixed py-2 bg-white border border-slate-100 rounded-2xl shadow-xl animate-fade-in-down origin-top overflow-hidden"
          style={{
            zIndex: 100005,
            top: rect.bottom + 8,
            left: rect.left,
            minWidth: Math.max(180, rect.width),
            width: rect.width
          }}
        >
          <div className="max-h-[280px] overflow-y-auto overscroll-contain custom-scrollbar-sm">
            {options.map(o => {
              const optColor = o.color || color;
              const optTheme = THEME_MAP[optColor] || THEME_MAP.slate;
              const isSelected = String(value) === String(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => { onChange(o.id); setIsOpen(false); }}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold transition-all cursor-pointer ${isSelected ? `${optTheme.bgSelected} ${optTheme.textSelected}` : `text-slate-600 ${optTheme.hoverBg} ${optTheme.hoverText}`}`}
                >
                  <div className="flex items-center gap-3 truncate">
                    {o.icon && <span className={`material-symbols-outlined text-[18px] ${isSelected ? optTheme.icon : 'text-slate-400'}`}>{o.icon}</span>}
                    <span className="truncate">{o.label}</span>
                  </div>
                  {isSelected && <span className="material-symbols-outlined text-[18px] shrink-0">check</span>}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default Dropdown;
