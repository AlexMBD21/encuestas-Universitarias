import React, { useState } from 'react';
import Modal from '../../components/ui/Modal';
import Dropdown from '../../components/ui/Dropdown';

export interface PrintConfig {
  includeStats: boolean;
  includeRanking: boolean;
  showOnlyWinners: boolean;
  includeComments: boolean;
  includeRawResponses: boolean;
  categoryFilter: string;
}

interface PrintConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPrint: (config: PrintConfig) => void;
  isProject: boolean;
  categories: string[];
}

export default function PrintConfigModal({ isOpen, onClose, onPrint, isProject, categories }: PrintConfigModalProps) {
  const [config, setConfig] = useState<PrintConfig>({
    includeStats: true,
    includeRanking: true,
    showOnlyWinners: false,
    includeComments: true,
    includeRawResponses: false,
    categoryFilter: 'Todas'
  });

  const Toggle = ({ title, subtitle, checked, onChange, disabled = false }: any) => (
    <div className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${checked && !disabled ? 'border-slate-300 bg-slate-50/50 shadow-sm' : 'border-slate-100 bg-white'} ${disabled ? 'opacity-50 grayscale' : 'hover:border-slate-200'}`}>
      <div className="flex-1 pr-4">
        <h4 className={`text-sm font-bold ${checked && !disabled ? 'text-slate-900' : 'text-slate-800'}`}>{title}</h4>
        {subtitle && <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">{subtitle}</p>}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${checked && !disabled ? 'bg-[#0f172a]' : 'bg-slate-200'}`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked && !disabled ? 'translate-x-5' : 'translate-x-0'}`}
        />
      </button>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Configurar Impresión" maxWidth="max-w-lg" scrollableBody={false} noHeaderShadow>
      <div className="flex flex-col flex-1 min-h-0">
        <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-2 shrink-0 relative z-10 shadow-[0_8px_20px_-4px_rgba(0,0,0,0.14)] dark:shadow-[0_8px_20px_-4px_rgba(0,0,0,0.45)]">
          {/* Helper alert */}
          <div className="bg-slate-50 border border-slate-200 text-slate-600 text-xs px-4 py-3 rounded-xl flex items-start gap-3">
            <span className="material-symbols-outlined text-slate-400 text-[18px] shrink-0 mt-0.5">info</span>
            <p className="font-medium">Selecciona qué secciones deseas incluir en el reporte PDF. Los saltos de página se ajustarán automáticamente.</p>
          </div>
        </div>

        <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-5 sm:pb-6 overflow-y-auto flex-1 custom-scrollbar relative z-0">
          <div className="space-y-3">
          <Toggle 
            title="Estadísticas de Preguntas" 
            subtitle="Gráficas y desgloses de respuestas simples."
            checked={config.includeStats} 
            onChange={(v: boolean) => setConfig({ ...config, includeStats: v })} 
          />

          {isProject && (
            <>
              <Toggle 
                title="Ranking de Proyectos" 
                subtitle="El podio y calificaciones medias de todos los evaluados."
                checked={config.includeRanking} 
                onChange={(v: boolean) => setConfig({ ...config, includeRanking: v })} 
              />
              
              {config.includeRanking && (
                <div className="ml-4 pl-4 border-l-2 border-slate-200 space-y-3">
                  {categories.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-0.5">Filtrar por Categoría</label>
                      <div className="[&>div]:!w-full relative z-20">
                        <Dropdown
                          value={config.categoryFilter}
                          label="Todas las categorías"
                          options={[
                            { id: 'Todas', label: 'Todas las categorías' },
                            ...categories.map(c => ({ id: c, label: c }))
                          ]}
                          onChange={(val) => setConfig({...config, categoryFilter: val})}
                          icon="category"
                          color="indigo"
                        />
                      </div>
                    </div>
                  )}
                  <Toggle 
                    title="Mostrar solo Ganadores" 
                    subtitle="Excluye los proyectos no ganadores o sin evaluar."
                    checked={config.showOnlyWinners} 
                    onChange={(v: boolean) => setConfig({ ...config, showOnlyWinners: v })} 
                  />
                </div>
              )}
            </>
          )}

          <Toggle 
            title="Anexos de Comentarios" 
            subtitle="Respuestas textuales y comentarios cualitativos."
            checked={config.includeComments} 
            onChange={(v: boolean) => setConfig({ ...config, includeComments: v })} 
          />

          <Toggle 
            title="Tabla de Respuestas Crudas" 
            subtitle="Lista de usuarios y sus respuestas columna por columna."
            checked={config.includeRawResponses} 
            onChange={(v: boolean) => setConfig({ ...config, includeRawResponses: v })} 
          />
        </div>

        </div>
        {/* Footer estático igual al de Categorías */}
        <div className="flex flex-col-reverse sm:flex-row items-center sm:justify-end gap-3 px-5 py-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shrink-0 rounded-b-[1.5rem] relative z-10 shadow-[0_-8px_20px_-4px_rgba(0,0,0,0.14)] dark:shadow-[0_-8px_20px_-4px_rgba(0,0,0,0.45)]">
          <button 
            type="button" 
            onClick={onClose}
            className="btn btn-ghost px-8"
          >
            Cancelar y Volver
          </button>
          <button 
            type="button" 
            onClick={() => {
              onPrint(config);
            }}
            className="btn btn-primary px-12"
          >
            <span className="material-symbols-outlined text-[22px]">print</span> 
            Generar PDF
          </button>
        </div>
      </div>
    </Modal>
  );
}
