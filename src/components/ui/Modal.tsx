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
}

export function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-2xl', fullHeightOnMobile = false, hideMobileIndicator = false, scrollableBody = true, hideCloseButton = false }: ModalProps) {
  const [isVisible, setIsVisible] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const [pullDownY, setPullDownY] = useState(0);
  const touchStartRef = useRef({ y: 0, scrollY: 0 });

  useEffect(() => {
    if (isOpen) {
      setIsVisible(false);
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
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
        className={`absolute inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-md transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />
      
      {/* Modal Container */}
      <div 
        ref={modalRef}
        className={`relative w-full ${maxWidth} bg-white dark:bg-slate-900 
          ${fullHeightOnMobile ? 'h-[90vh] sm:h-auto' : 'max-h-[90vh]'} 
          rounded-t-[2rem] sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden 
          transition-all duration-300 ease-[cubic-bezier(0.2,0.9,0.3,1.1)]
          ${isVisible ? 'translate-y-0 opacity-100 sm:scale-100' : 'translate-y-full opacity-0 sm:translate-y-8 sm:scale-95'}`}
        style={{
          transform: pullDownY > 0 ? `translateY(${pullDownY}px)` : undefined,
          transition: pullDownY > 0 ? 'none' : undefined
        }}
        onTouchStart={(e) => {
          const target = e.target as HTMLElement;
          const scrollable = target.closest('.modal-scrollable-content');
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
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 z-10">
            <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
              {title}
            </h2>
            {!hideCloseButton && (
              <button 
                type="button"
                onClick={handleClose} 
                className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <span className="material-symbols-outlined text-[24px]">close</span>
              </button>
            )}
          </div>
        )}

        {/* Body content */}
        <div className={`flex-1 flex flex-col ${scrollableBody ? 'overflow-y-auto overscroll-contain modal-scrollable-content' : 'overflow-hidden'} bg-slate-50 dark:bg-slate-900/50`}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default Modal;
