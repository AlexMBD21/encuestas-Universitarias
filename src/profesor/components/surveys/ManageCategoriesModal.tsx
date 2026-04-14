import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import supabaseClient from '../../../services/supabaseClient';

export interface ManageCategoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCategories: string[];
  onSaveSuccess: (finalCategories: string[]) => void;
}

export const ManageCategoriesModal = ({ isOpen, onClose, initialCategories, onSaveSuccess }: ManageCategoriesModalProps) => {
  const [categoriesList, setCategoriesList] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');

  useEffect(() => {
    if (isOpen) {
      setCategoriesList([...initialCategories]);
      setNewCategoryInput('');
    }
  }, [isOpen, initialCategories]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const finalCategories = categoriesList.map(c => c.trim()).filter(Boolean);
      
      const dataClientNow: any = supabaseClient;
      let existing: any = null;
      try {
        existing = await dataClientNow.getSurveyById('sys_settings_project_categories');
      } catch (e) {}

      const updated = { 
        ...(existing || {}), 
        id: 'sys_settings_project_categories',
        type: 'system',
        title: 'Configuración Global de Categorías de Proyecto',
        rubric: finalCategories,
        allowed_categories: finalCategories 
      };

      await dataClientNow.setSurvey('sys_settings_project_categories', updated);
      onSaveSuccess(finalCategories);
      onClose();
    } catch (e) {
      console.error(e);
      alert('Error al guardar categorías');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md" hideMobileIndicator={true} scrollableBody={false}>
      <div className="flex flex-col h-full sm:max-h-[85vh] relative overflow-hidden">
        {/* Drag handle for mobile */}
        <div className="w-full flex justify-center pt-2 pb-2 sm:hidden absolute top-0 z-20 cursor-pointer" style={{ touchAction: 'none' }} onClick={onClose}>
          <div className="w-12 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700"></div>
        </div>

        {/* Header — clean premium */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0 rounded-t-[2rem] sm:rounded-[1.5rem] sm:rounded-b-none pt-8 sm:pt-4 z-10 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <h3 className="text-lg sm:text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Categorías del Proyecto</h3>
          <div className="hidden sm:block">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors outline-none"
            >
              <span className="material-symbols-outlined text-[24px]">close</span>
            </button>
          </div>
        </div>

        {/* Subtitle bar */}
        <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shrink-0 flex flex-col gap-1.5 items-start">
          <span className="text-[10px] font-black px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-full">
            {categoriesList.length} REGISTRADAS
          </span>
          <p className="text-[11px] text-slate-500 font-semibold dark:text-slate-400 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px]">info</span>
            Opciones visibles para los alumnos al inscribir su proyecto
          </p>
        </div>

        {/* List */}
        <div className="modal-scrollable-content flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-white dark:bg-slate-900">
          {categoriesList.length === 0 && (
            <div className="py-10 text-center">
              <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 block mb-2">category</span>
              <p className="text-sm text-slate-500 dark:text-slate-400">No hay categorías aún.<br />Añade la primera usando el campo de abajo.</p>
            </div>
          )}
          {categoriesList.map((cat, idx) => (
            <div key={idx} className="flex items-center gap-3 px-4 py-3 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-2xl shadow-sm">
              <span className="w-7 h-7 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 text-xs font-black shrink-0 shadow-sm">{idx + 1}</span>
              <div className="flex-1">
                <input
                  className="min-w-0 w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  value={cat}
                  onChange={e => setCategoriesList(prev => prev.map((c, i) => i === idx ? e.target.value : c))}
                  placeholder="Nombre de categoría"
                />
              </div>
              <button
                type="button"
                onClick={() => setCategoriesList(prev => prev.filter((_, i) => i !== idx))}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </div>
          ))}
        </div>

        {/* Add new input */}
        <div className="px-4 sm:px-5 py-4 bg-slate-100 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 shrink-0 shadow-[inset_0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="flex gap-1.5 sm:gap-2">
            <input
              className="min-w-0 flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3.5 sm:px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400 shadow-sm"
              placeholder="Nueva categoría..."
              value={newCategoryInput}
              onChange={e => setNewCategoryInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && newCategoryInput.trim()) {
                  e.preventDefault();
                  setCategoriesList(prev => [...prev, newCategoryInput.trim()]);
                  setNewCategoryInput('');
                }
              }}
            />
            <button
              type="button"
              onClick={() => {
                if (newCategoryInput.trim()) {
                  setCategoriesList(prev => [...prev, newCategoryInput.trim()]);
                  setNewCategoryInput('');
                }
              }}
              disabled={!newCategoryInput.trim()}
              className="px-4 py-2 bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 border border-blue-600 hover:border-blue-700 text-white font-bold rounded-xl transition-all text-sm flex items-center gap-1.5 shrink-0 disabled:opacity-50 disabled:from-blue-400 disabled:to-blue-500 shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),0_4px_10px_0_rgba(37,99,235,0.2)] whitespace-nowrap active:scale-95"
            >
              <span className="material-symbols-outlined text-[20px]">add</span> Añadir
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row items-center sm:justify-end gap-3 px-5 py-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="w-full sm:w-auto px-4 py-2 sm:px-6 sm:py-2.5 bg-transparent hover:bg-slate-50 text-slate-600 font-bold rounded-2xl dark:hover:bg-slate-800/60 dark:text-slate-400 transition-all text-sm border border-slate-300 dark:border-slate-600 active:scale-[0.98]"
          >
            Cancelar y Volver
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="w-full sm:w-auto px-5 py-2 sm:px-8 sm:py-2.5 bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 border border-blue-600 hover:border-blue-700 disabled:opacity-60 text-white font-black rounded-2xl transition-all text-sm flex items-center justify-center gap-2 shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),0_4px_14px_0_rgba(37,99,235,0.3)] active:scale-[0.98]"
          >
            {saving ? (
              <span className="animate-spin material-symbols-outlined">refresh</span>
            ) : (
              <><span className="material-symbols-outlined text-[20px]">save</span> Guardar Categorías</>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};
