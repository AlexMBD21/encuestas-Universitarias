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
    <div className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${checked && !disabled ? 'border-blue-100 bg-blue-50/50 shadow-sm' : 'border-slate-100 bg-white'} ${disabled ? 'opacity-50 grayscale' : 'hover:border-slate-200'}`}>
      <div className="flex-1 pr-4">
        <h4 className={`text-sm font-bold ${checked && !disabled ? 'text-blue-900' : 'text-slate-800'}`}>{title}</h4>
        {subtitle && <p className="text-xs text-slate-500 mt-1 leading-relaxed">{subtitle}</p>}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${checked && !disabled ? 'bg-blue-600' : 'bg-slate-200'}`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked && !disabled ? 'translate-x-5' : 'translate-x-0'}`}
        />
      </button>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Configurar Impresión" maxWidth="max-w-lg" scrollableBody={false}>
      <div className="flex flex-col max-h-[calc(100vh-10rem)] bg-slate-50">
        <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-2 shrink-0">
          {/* Helper alert */}
          <div className="bg-blue-50/50 border border-blue-100 text-blue-800 text-sm px-4 py-3 rounded-xl flex items-start gap-3">
            <span className="material-symbols-outlined text-blue-500 text-[20px] shrink-0 mt-0.5">info</span>
            <p>Selecciona qué secciones deseas incluir en el reporte PDF. Los saltos de página se ajustarán automáticamente.</p>
          </div>
        </div>

        <div className="px-5 sm:px-6 pb-5 sm:pb-6 overflow-y-auto flex-1 custom-scrollbar">
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
                <div className="ml-4 pl-4 border-l-2 border-blue-100 space-y-3">
                  {categories.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-600">Filtrar por Categoría</label>
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
                          color="blue"
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
        <div className="flex flex-col-reverse sm:flex-row items-center sm:justify-end gap-3 px-5 py-4 bg-white border-t border-slate-100 shrink-0 rounded-b-[1.5rem]">
          <button 
            type="button" 
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-3 sm:py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition-all text-sm border border-slate-200"
          >
            Cancelar y Volver
          </button>
          <button 
            type="button" 
            onClick={() => {
              onPrint(config);
            }}
            className="w-full sm:w-auto px-8 py-3 sm:py-2 bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 border border-blue-600 hover:border-blue-700 text-white font-black rounded-2xl transition-all text-sm flex items-center justify-center gap-2 shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),0_4px_14px_0_rgba(37,99,235,0.3)] active:scale-95"
          >
            <span className="material-symbols-outlined text-[20px]">print</span> 
            Generar PDF
          </button>
        </div>
      </div>
    </Modal>
  );
}
