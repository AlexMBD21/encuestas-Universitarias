import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export interface CalendarEvent {
  id: string;
  type: 'survey' | 'report' | 'other';
  title: string;
  date: string; // Formato YYYY-MM-DD
  color: string; // Clase de Tailwind para el badge/dot (ej. bg-blue-500)
}

interface CalendarWidgetProps {
  events: CalendarEvent[];
  onClose?: () => void;
}

export const CalendarWidget: React.FC<CalendarWidgetProps> = ({ events, onClose }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose?.();
      setIsClosing(false);
    }, 300);
  };

  // Bloquear el scroll del body mientras el calendario está abierto
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  // Escuchar clicks fuera del widget para cerrarlo
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (widgetRef.current && !widgetRef.current.contains(event.target as Node)) {
        handleClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Domingo, 1 = Lunes...

  // Ajustar para que la semana empiece en Lunes (opcional, estándar de calendarios)
  // Si firstDayOfMonth es 0 (Domingo), lo volvemos 6. El resto se resta 1.
  const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  // Agrupar eventos por fecha
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    events.forEach(ev => {
      if (!map[ev.date]) map[ev.date] = [];
      map[ev.date].push(ev);
    });
    return map;
  }, [events]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const content = (
    <div className="fixed inset-0 z-[100002] pointer-events-none">
      <style>{`
        @keyframes calSlideIn { 
          from { transform: translateX(100%); opacity: 0; } 
          to { transform: translateX(0); opacity: 1; } 
        }
        @keyframes calSlideOut { 
          from { transform: translateX(0); opacity: 1; } 
          to { transform: translateX(100%); opacity: 0; } 
        }
        .cal-panel { 
          animation: calSlideIn 0.4s cubic-bezier(0.2, 0.9, 0.3, 1.1) forwards; 
          pointer-events: auto; 
        }
        .cal-panel.closing {
          animation: calSlideOut 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
      `}</style>
      
      {/* Calendar Side Panel */}
      <div 
        ref={widgetRef}
        className={`fixed top-[56px] right-0 bottom-0 w-[420px] flex flex-col bg-[#0f172a] border-l border-white/5 shadow-[-30px_0_90px_-20px_rgba(0,0,0,0.4)] cal-panel overflow-hidden ${isClosing ? 'closing' : ''}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-3">
             <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center shadow-inner shadow-white/5">
                <span className="material-symbols-outlined text-white text-2xl font-bold">calendar_month</span>
             </div>
             <div className="flex flex-col">
                <h2 className="text-xl font-black text-white tracking-tighter uppercase leading-none">Calendario</h2>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Actividad Académica</span>
             </div>
          </div>
          <button 
            onClick={handleClose}
            className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all active:scale-95 group"
          >
            <span className="material-symbols-outlined group-hover:rotate-90 transition-transform duration-300">close</span>
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
          {/* Calendar Navigation */}
          <div className="flex items-center justify-between mb-8 bg-slate-800/40 p-1.5 rounded-2xl border border-white/5">
            <button 
              onClick={prevMonth}
              className="w-9 h-9 rounded-xl hover:bg-slate-700/60 flex items-center justify-center text-primary transition-all active:scale-90"
            >
              <span className="material-symbols-outlined text-base font-bold">chevron_left</span>
            </button>
            <span className="text-xs font-black text-white uppercase tracking-[0.2em]">
              {monthNames[month]} {year}
            </span>
            <button 
              onClick={nextMonth}
              className="w-9 h-9 rounded-xl hover:bg-slate-700/60 flex items-center justify-center text-primary transition-all active:scale-90"
            >
              <span className="material-symbols-outlined text-base font-bold">chevron_right</span>
            </button>
          </div>

          {/* Days Weekday */}
          <div className="grid grid-cols-7 gap-1 mb-4">
            {['LU', 'MA', 'MI', 'JU', 'VI', 'SÁ', 'DO'].map((d) => (
              <div key={d} className="text-center text-[10px] font-black text-slate-500 py-1 tracking-tighter">
                {d}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-y-3 gap-x-1">
            {Array.from({ length: startOffset }).map((_, i) => (
              <div key={`empty-${i}`} className="h-10"></div>
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayEvents = eventsByDate[dateString] || [];
              const today = new Date();
              const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
              const isToday = localToday === dateString;
              const isSelected = selectedDate === dateString;

              const eventColors = Array.from(new Set(dayEvents.map(e => e.color)));

              return (
                <div key={day} className="flex flex-col items-center group">
                  <button
                    onClick={() => setSelectedDate(isSelected ? null : dateString)}
                    className={`
                      relative h-10 w-10 rounded-2xl flex items-center justify-center text-sm transition-all duration-300
                      ${isSelected ? 'bg-white text-[#0f172a] font-extrabold shadow-xl shadow-white/10 scale-110 z-10' : ''}
                      ${!isSelected && isToday ? 'bg-primary text-white font-black border border-white/10' : ''}
                      ${!isSelected && !isToday ? 'text-slate-300 font-bold hover:bg-white/10 hover:scale-105' : ''}
                    `}
                  >
                    {day}
                    {/* Indicator dots inside the box */}
                    {eventColors.length > 0 && (
                      <div className="absolute bottom-1.5 flex gap-0.5">
                        {eventColors.slice(0, 3).map((color, idx) => (
                          <div key={idx} className={`w-0.5 h-0.5 rounded-full ${color}`}></div>
                        ))}
                      </div>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Selected Events Viewer */}
          {selectedDate && (
            <div className="mt-12 animate-in fade-in slide-in-from-bottom-4 duration-500 text-slate-100">
              <div className="flex items-center justify-between mb-4">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Actividad del día</div>
                <div className="text-[10px] font-bold text-slate-200 bg-white/10 px-2 py-0.5 rounded-full">{selectedDate}</div>
              </div>
              
              {eventsByDate[selectedDate] && eventsByDate[selectedDate].length > 0 ? (
                <div className="space-y-4">
                  {eventsByDate[selectedDate].map((ev, idx) => (
                    <div 
                      key={idx} 
                      className="group relative flex items-center gap-4 p-4 rounded-3xl bg-slate-800/30 border border-white/5 hover:bg-slate-800/50 transition-all duration-500 overflow-hidden"
                    >
                      <div className={`absolute top-0 left-0 w-1 h-full ${ev.color}`}></div>
                      <div className={`w-8 h-8 rounded-xl ${ev.color}/10 flex items-center justify-center`}>
                         <div className={`w-2 h-2 rounded-full ${ev.color} animate-pulse`}></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">{ev.type === 'survey' ? 'Encuesta' : 'Actividad'}</div>
                        <div className="text-sm font-black text-slate-100 truncate leading-tight tracking-tight">{ev.title}</div>
                      </div>
                      <span className="material-symbols-outlined text-slate-600 group-hover:text-primary transition-colors text-lg">chevron_right</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 opacity-20 grayscale">
                   <span className="material-symbols-outlined text-4xl mb-2">event_busy</span>
                   <p className="text-xs font-bold text-slate-400 tracking-widest uppercase">Sin eventos</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(content, document.body);
};
