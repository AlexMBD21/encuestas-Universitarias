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
  closeButtonVariant?: 'default' | 'premium';
}

export function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-2xl', fullHeightOnMobile = false, hideMobileIndicator = false, scrollableBody = true, hideCloseButton = false, noHeaderShadow = false, closeButtonVariant = 'premium' }: ModalProps) {
  const [isVisible, setIsVisible] = useState(false);
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
    setIsVisible(false);
    setTimeout(() => {
      setPullDownY(0);
      onClose();
    }, 300);
  };

  if (!isOpen && !isVisible) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center p-0 sm:p-4 perspective-1000">
      {/* Backdrop */}
      <div 
        className={`absolute inset-0 bg-slate-900/60 dark:bg-slate-950/80 transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />
      
      {/* Modal Container */}
      <div 
        ref={modalRef}
        className={`relative w-full ${maxWidth} bg-white dark:bg-slate-900 
          ${fullHeightOnMobile ? 'h-[90vh] sm:h-auto sm:max-h-[85vh]' : 'max-h-[90vh]'} 
          rounded-t-[20px] sm:rounded-[20px] shadow-2xl flex flex-col overflow-hidden 
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
          <div className="w-full flex justify-center py-3 sm:hidden shrink-0 touch-none active:bg-slate-50 dark:active:bg-slate-800 transition-colors" onClick={handleClose}>
            <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full" />
          </div>
        )}

        {/* Header */}
        {title && (
          <div className={`flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 relative z-10 ${noHeaderShadow ? '' : 'shadow-[0_8px_20px_-4px_rgba(0,0,0,0.14)] dark:shadow-[0_8px_20px_-4px_rgba(0,0,0,0.45)]'}`}>
            <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
              {title}
            </h2>
            {!hideCloseButton && (
              <button 
                type="button"
                onClick={handleClose} 
                className={`hidden sm:flex w-10 h-10 items-center justify-center rounded-full transition-all active:scale-95 shadow-sm group ${
                  closeButtonVariant === 'premium' 
                    ? 'bg-[#0f172a] text-white hover:bg-[#1e293b]' 
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100'
                }`}
                aria-label="Cerrar"
              >
                <span className="material-symbols-outlined text-[20px] group-hover:rotate-90 transition-transform duration-300">close</span>
              </button>
            )}
          </div>
        )}

        {/* Body content */}
        <div className={`flex-1 flex flex-col ${scrollableBody ? 'overflow-y-auto overscroll-contain modal-scrollable-content bg-slate-50 dark:bg-slate-900/50' : 'overflow-hidden bg-white dark:bg-slate-900'}`}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default Modal;
