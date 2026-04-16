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
  const widgetRef = useRef<HTMLDivElement>(null);

  // Escuchar clicks fuera del widget para cerrarlo
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (widgetRef.current && !widgetRef.current.contains(event.target as Node)) {
        onClose?.();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

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
        @keyframes calFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes calSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .cal-backdrop { animation: calFadeIn 0.3s ease forwards; pointer-events: auto; }
        .cal-drawer { animation: calSlideIn 0.4s cubic-bezier(0.2, 0.9, 0.3, 1.1) forwards; pointer-events: auto; }
      `}</style>
      
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 cal-backdrop"
        onClick={onClose}
      />

      {/* Drawer */}
      <div 
        ref={widgetRef}
        className="absolute top-0 right-0 bottom-0 w-full max-w-sm flex flex-col bg-white/70 backdrop-blur-3xl border-l border-white/40 shadow-[-20px_0_50px_rgba(0,0,0,0.1)] cal-drawer"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200/40">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-2xl font-bold">calendar_month</span>
             </div>
             <h2 className="text-xl font-black text-slate-800 tracking-tighter uppercase">Calendario</h2>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-slate-100/50 flex items-center justify-center text-slate-400 hover:text-slate-800 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
          {/* Calendar Navigation */}
          <div className="flex items-center justify-between mb-8 bg-white/40 p-2 rounded-2xl border border-white/60 shadow-sm">
            <button 
              onClick={prevMonth}
              className="w-8 h-8 rounded-xl hover:bg-white flex items-center justify-center text-slate-400 hover:text-primary transition-all shadow-sm"
            >
              <span className="material-symbols-outlined text-sm font-bold">chevron_left</span>
            </button>
            <span className="text-sm font-black text-slate-800 uppercase tracking-widest">
              {monthNames[month]} {year}
            </span>
            <button 
              onClick={nextMonth}
              className="w-8 h-8 rounded-xl hover:bg-white flex items-center justify-center text-slate-400 hover:text-primary transition-all shadow-sm"
            >
              <span className="material-symbols-outlined text-sm font-bold">chevron_right</span>
            </button>
          </div>

          {/* Days Weekday */}
          <div className="grid grid-cols-7 gap-1 mb-4">
            {['LU', 'MA', 'MI', 'JU', 'VI', 'SÁ', 'DO'].map((d) => (
              <div key={d} className="text-center text-[10px] font-black text-slate-400 py-1 tracking-tighter">
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
                      ${isSelected ? 'bg-primary text-white font-black shadow-lg shadow-primary/30 scale-110 z-10' : ''}
                      ${!isSelected && isToday ? 'bg-primary/10 text-primary font-black border border-primary/20' : ''}
                      ${!isSelected && !isToday ? 'text-slate-600 font-bold hover:bg-slate-100 hover:scale-105' : ''}
                    `}
                  >
                    {day}
                    {/* Indicator dots inside the box */}
                    {!isSelected && eventColors.length > 0 && (
                      <div className="absolute bottom-1 flex gap-0.5">
                        {eventColors.slice(0, 3).map((color, idx) => (
                          <div key={idx} className={`w-1 h-1 rounded-full ${color.replace('bg-', 'bg-')}`}></div>
                        ))}
                        {eventColors.length > 3 && <div className="w-1 h-1 rounded-full bg-slate-300"></div>}
                      </div>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Selected Events Viewer */}
          {selectedDate && (
            <div className="mt-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between mb-4">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Actividad del día</div>
                <div className="text-[10px] font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-full">{selectedDate}</div>
              </div>
              
              {eventsByDate[selectedDate] && eventsByDate[selectedDate].length > 0 ? (
                <div className="space-y-3">
                  {eventsByDate[selectedDate].map((ev, idx) => (
                    <div 
                      key={idx} 
                      className="group flex items-center gap-4 p-4 rounded-2xl bg-white/50 border border-white hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300"
                    >
                      <div className={`w-3 h-3 rounded-full shadow-sm ${ev.color}`}></div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-0.5">{ev.type === 'survey' ? 'Encuesta' : 'Actividad'}</div>
                        <div className="text-sm font-black text-slate-800 truncate leading-tight">{ev.title}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 opacity-40 grayscale">
                   <span className="material-symbols-outlined text-4xl mb-2">event_busy</span>
                   <p className="text-xs font-bold text-slate-500 tracking-widest uppercase">Sin eventos</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Pill */}
        <div 
          onClick={onClose}
          className="px-6 py-6 bg-slate-50/30 flex justify-center border-t border-slate-200/20 cursor-pointer hover:bg-slate-100/40 transition-all group"
        >
           <div className="w-16 h-1 bg-slate-300 rounded-full opacity-40 group-hover:opacity-100 group-hover:bg-primary transition-all duration-300" />
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(content, document.body);
};
