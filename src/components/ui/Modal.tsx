import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: string; // e.g. 'max-w-2xl', 'max-w-4xl'
  fullHeightOnMobile?: boolean;
  hideMobileIndicator?: boolean;
  scrollableBody?: boolean;
  hideCloseButton?: boolean;
  noHeaderShadow?: boolean;
  noFooterShadow?: boolean;
  closeButtonVariant?: 'default' | 'premium';
  footer?: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-2xl', fullHeightOnMobile = false, hideMobileIndicator = false, scrollableBody = true, hideCloseButton = false, noHeaderShadow = false, noFooterShadow = false, closeButtonVariant = 'premium', footer }: ModalProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isClosingBtn, setIsClosingBtn] = useState(false);
  const [isCloseBtnTouched, setIsCloseBtnTouched] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const [pullDownY, setPullDownY] = useState(0);
  const touchStartRef = useRef({ y: 0, scrollY: 0 });

  useEffect(() => {
    if (isOpen) {
      setIsVisible(false);
      const prevOverflow = document.body.style.overflow;
      const prevOverscroll = document.body.style.overscrollBehavior;
      const prevDocOverscroll = document.documentElement.style.overscrollBehavior;
      
      document.body.style.overflow = 'hidden';
      document.body.style.overscrollBehavior = 'none';
      document.documentElement.style.overscrollBehavior = 'none';
      
      const t = setTimeout(() => setIsVisible(true), 50);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          handleClose();
        }
      };
      window.addEventListener('keydown', handleKeyDown);

      return () => {
        clearTimeout(t);
        document.body.style.overflow = prevOverflow;
        document.body.style.overscrollBehavior = prevOverscroll;
        document.documentElement.style.overscrollBehavior = prevDocOverscroll;
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      setIsVisible(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    const el = modalRef.current;
    if (!el) return;

    const handleTouchMove = (e: TouchEvent) => {
      if (touchStartRef.current.scrollY > 0) return;
      const deltaY = e.touches[0].clientY - touchStartRef.current.y;
      if (deltaY > 0) {
        if (e.cancelable) e.preventDefault();
        setPullDownY(deltaY);
      }
    };

    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => {
      el.removeEventListener('touchmove', handleTouchMove);
    };
  }, [isVisible]);

  const handleClose = () => {
    // Activar animación de giro persistente
    setIsClosingBtn(true);
    
    // Breve retraso para apreciar la animación del botón (giro/3D)
    setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => {
        setPullDownY(0);
        setIsClosingBtn(false);
        onClose();
      }, 300);
    }, 250);
  };

  if (!isOpen && !isVisible) return null;

  // Premium spacious layout mapping:
  const widthScaleMap: Record<string, string> = {
    'max-w-md': 'max-w-lg sm:max-w-xl md:max-w-2xl', 
    'max-w-lg': 'max-w-xl sm:max-w-2xl md:max-w-3xl',
    'max-w-xl': 'max-w-2xl sm:max-w-3xl md:max-w-4xl',
    'max-w-2xl': 'max-w-3xl sm:max-w-4xl md:max-w-5xl',
    'max-w-3xl': 'max-w-4xl sm:max-w-5xl md:max-w-6xl',
    'max-w-4xl': 'max-w-5xl sm:max-w-6xl md:max-w-7xl',
    'max-w-6xl': 'max-w-7xl sm:max-w-[90vw] xl:max-w-[85vw]'
  };

  const resolvedWidthClass = widthScaleMap[maxWidth] || maxWidth || 'max-w-2xl sm:max-w-4xl';

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center p-0 sm:p-4 perspective-1000">
      {/* Backdrop */}
      <div 
        className={`absolute inset-0 bg-slate-900/40 dark:bg-slate-950/70 backdrop-blur-sm transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />
      
      {/* Modal Container */}
      <div 
        ref={modalRef}
        className={`relative w-full ${resolvedWidthClass} bg-white dark:bg-slate-900 
          ${fullHeightOnMobile ? 'h-[90vh] sm:h-auto sm:max-h-[85vh]' : 'max-h-[90vh]'} 
          rounded-t-[20px] sm:rounded-[20px] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] border border-white/60 dark:border-white/20 flex flex-col overflow-hidden 
          transition-all duration-300 ease-[cubic-bezier(0.2,0.9,0.3,1.1)]
          ${isVisible ? 'translate-y-0 opacity-100 sm:scale-100' : 'translate-y-full opacity-0 sm:translate-y-8 sm:scale-95'}`}
        style={{
          transform: pullDownY > 0 ? `translateY(${pullDownY}px)` : undefined,
          transition: pullDownY > 0 ? 'none' : undefined
        }}
        onTouchStart={(e) => {
          const target = e.target as HTMLElement;
          const scrollable = target.closest('.modal-scrollable-content, .overflow-y-auto, .overflow-auto, [style*="overflow-y: auto"], [style*="overflow: auto"]');
          touchStartRef.current = { y: e.touches[0].clientY, scrollY: scrollable ? scrollable.scrollTop : 0 };
        }}
        onTouchEnd={() => {
          if (pullDownY > 150) handleClose();
          else setPullDownY(0);
        }}
      >
        {/* Mobile Drag Indicator */}
        {!hideMobileIndicator && (
          <div className="w-full flex justify-center py-4 sm:hidden shrink-0 touch-none bg-[#0d1425] active:bg-[#1a233a] transition-colors" onClick={handleClose}>
            <div className="w-12 h-1.5 bg-white/30 rounded-full" />
          </div>
        )}

        {/* Header */}
        {(title || !hideCloseButton) && (
          <div className={`flex items-center justify-between px-6 sm:px-10 py-5 sm:py-6 border-b border-transparent shrink-0 bg-[#0d1425] relative z-10 ${noHeaderShadow ? '' : 'shadow-[0_8px_20px_-4px_rgba(13,20,37,0.4),inset_0_1px_0_rgba(255,255,255,0.15),inset_1px_0_0_rgba(255,255,255,0.05),inset_-1px_0_0_rgba(255,255,255,0.05)]'} min-h-[60px] sm:min-h-[80px]`}>
            {title && (
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight drop-shadow-sm m-0 leading-none">
                {title}
              </h2>
            )}
            
            {!hideCloseButton && (
              <button 
                type="button"
                onClick={handleClose} 
                onTouchStart={() => setIsCloseBtnTouched(true)}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  // Mantener el rojo visible brevemente antes de cerrar
                  setTimeout(() => {
                    setIsCloseBtnTouched(false);
                    handleClose();
                  }, 150);
                }}
                className={`ml-auto z-[60] flex shrink-0 w-10 h-10 items-center justify-center rounded-full transition-all duration-300 border group outline-none -mr-2 sm:-mr-4
                  ${isClosingBtn 
                    ? 'scale-0 rotate-[360deg] shadow-none opacity-0 bg-white/10 border-white/20 text-white' 
                    : isCloseBtnTouched
                      ? 'bg-red-500 border-red-400 shadow-[0_4px_20px_rgba(239,68,68,0.5)] scale-110 text-white ring-4 ring-red-500/30'
                      : 'bg-white/10 border-white/20 text-white shadow-[0_4px_12px_rgba(0,0,0,0.15)] hover:bg-red-500 hover:border-red-400 hover:shadow-[0_4px_20px_rgba(239,68,68,0.4)] hover:scale-110 active:scale-95 active:bg-red-600 ring-0 hover:ring-4 ring-red-500/30'}`}
                aria-label="Cerrar"
              >
                <span className={`material-symbols-outlined text-[22px] transition-transform duration-300 group-hover:rotate-90 ${isCloseBtnTouched ? 'rotate-90' : ''}`}>close</span>
              </button>
            )}
          </div>
        )}

        {/* Body content */}
        <div className={`flex-1 min-h-0 flex flex-col ${scrollableBody ? 'overflow-y-auto overscroll-contain modal-scrollable-content bg-gradient-to-b from-blue-50/50 to-slate-50 dark:from-slate-900 dark:to-slate-900/50' : 'overflow-hidden bg-gradient-to-b from-blue-50/50 to-slate-50 dark:from-slate-900 dark:to-slate-900/50'}`}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className={`flex items-center justify-end px-6 sm:px-10 py-5 border-t border-slate-200/60 dark:border-slate-800 shrink-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md relative z-10 ${noFooterShadow ? '' : 'shadow-[0_-8px_24px_-4px_rgba(0,0,0,0.12)] dark:shadow-[0_-8px_24px_-4px_rgba(0,0,0,0.4)]'}`}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export default Modal;
