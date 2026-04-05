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
    <>
      <style>{`
        @keyframes slideInRightCal { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .animate-slide-in-right-cal { animation: slideInRightCal 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
      
      {/* Cajón lateral (Slide-over drawer) sin fondo difuminado */}
      <div 
        ref={widgetRef}
        className="fixed z-[1000] w-full max-w-sm shadow-2xl flex flex-col bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 animate-slide-in-right-cal"
        style={{ top: 'var(--topbar-height)', right: 0, bottom: 0 }}
      >
        {/* Encabezado del Drawer */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700 shrink-0">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Calendario</h2>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
          {/* Cabecera del Calendario */}
          <div className="flex items-center justify-between mb-4">
        <button 
          onClick={prevMonth}
          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition"
        >
          <span className="material-symbols-outlined text-sm">chevron_left</span>
        </button>
        <span className="font-semibold text-slate-800 dark:text-slate-100">
          {monthNames[month]} {year}
        </span>
        <button 
          onClick={nextMonth}
          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition"
        >
          <span className="material-symbols-outlined text-sm">chevron_right</span>
        </button>
      </div>

      {/* Días de la semana */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'].map((d) => (
          <div key={d} className="text-center text-xs font-medium text-slate-400 dark:text-slate-500 py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Cuadrícula de Días */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: startOffset }).map((_, i) => (
          <div key={`empty-${i}`} className="h-8"></div>
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayEvents = eventsByDate[dateString] || [];
          const isToday = new Date().toISOString().split('T')[0] === dateString;
          const isSelected = selectedDate === dateString;

          // Extraer colores únicos para los puntos del día
          const eventColors = Array.from(new Set(dayEvents.map(e => e.color)));

          return (
            <div key={day} className="flex flex-col items-center">
              <button
                onClick={() => setSelectedDate(isSelected ? null : dateString)}
                className={`
                  h-8 w-8 rounded-full flex items-center justify-center text-sm transition-all
                  ${isSelected ? 'text-white font-bold shadow-md' : ''}
                  ${!isSelected && isToday ? 'border-2 font-bold' : ''}
                  ${!isSelected && !isToday ? 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700' : ''}
                `}
                style={{ 
                  backgroundColor: isSelected ? 'var(--color-primary)' : undefined, 
                  borderColor: (!isSelected && isToday) ? 'var(--color-primary)' : undefined,
                  color: (isSelected) ? 'white' : ((!isSelected && isToday) ? 'var(--color-primary)' : undefined),
                  "--tw-bg-opacity": 1
                } as React.CSSProperties}
              >
                {day}
              </button>
              
              {/* Puntos de eventos */}
              <div className="flex gap-0.5 mt-0.5 h-1">
                {eventColors.map((color, idx) => (
                   <span key={idx} className={`w-1 h-1 rounded-full ${color}`}></span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Visor de eventos seleccionados */}
      {selectedDate && (
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
          <div className="text-xs font-semibold text-slate-500 mb-2">Eventos de este día:</div>
          {eventsByDate[selectedDate] && eventsByDate[selectedDate].length > 0 ? (
            <div className="flex flex-col gap-2 max-h-32 overflow-y-auto custom-scrollbar">
              {eventsByDate[selectedDate].map((ev, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm bg-slate-50 dark:bg-slate-900/50 p-2 rounded border border-slate-100 dark:border-slate-700">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${ev.color}`}></div>
                  <span className="text-slate-700 dark:text-slate-200 truncate" title={ev.title}>{ev.title}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-400 italic">No hay actividad este día.</div>
          )}
        </div>
      )}
        </div>
      </div>
    </>
  );

  if (!mounted) return null;
  return createPortal(content, document.body);
};
