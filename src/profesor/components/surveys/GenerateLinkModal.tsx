import React from 'react';
import { Modal } from '../../../components/ui/Modal';
import ButtonLoader from '../../../components/ButtonLoader';

export const GenerateLinkModal = ({ isOpen, onClose, survey, dataClientNow, onSave }: any) => {
  const [saving, setSaving] = React.useState(false);

  // We use scrollableBody = false because it's a short form, but just in case we let the form content scroll.
  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      maxWidth="max-w-md" 
      hideMobileIndicator={true} 
      scrollableBody={false}
      title={
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm shrink-0">
            <span className="material-symbols-outlined text-[26px]">calendar_month</span>
          </div>
          <span className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Establecer Fecha Límite</span>
        </div>
      }
      footer={
        <div className="w-full flex justify-end">
          <button 
            type="submit" 
            form="generate-link-form" 
            disabled={saving} 
            className="btn btn-primary w-full sm:w-auto px-10"
          >
            {saving ? <><ButtonLoader size={20} /> Guardando...</> : <><span className="material-symbols-outlined text-[20px]">save</span> Guardar Fecha</>}
          </button>
        </div>
      }
    >
      <div className="flex flex-col h-full relative overflow-hidden bg-white dark:bg-slate-900">
        <div className="modal-scrollable-content px-6 sm:px-10 py-6 flex-1 overflow-y-auto overscroll-contain">
          <p className="text-[15px] text-slate-500 dark:text-slate-400 mb-8 leading-relaxed font-medium pl-1">
            Guarda la fecha máxima de inscripción para habilitar el enlace público.
          </p>

          <form id="generate-link-form" onSubmit={async (e) => {
            e.preventDefault()
            const formData = new FormData(e.currentTarget)
            const dateVal = formData.get('expiryDate') as string
            if (!dateVal || !survey) return

            const parts = dateVal.split('-')
            let expires = new Date().toISOString()
            if (parts.length === 3) {
              const y = parseInt(parts[0], 10)
              const m = parseInt(parts[1], 10) - 1
              const d = parseInt(parts[2], 10)
              expires = new Date(y, m, d, 23, 59, 59).toISOString()
            }

            const token = Math.random().toString(36).substring(2, 12)

            setSaving(true)
            try {
              const updated = { ...survey, linkToken: token, linkExpiresAt: expires }
              await (dataClientNow as any).setSurvey(String(survey.id), updated)
              onSave(updated)
            } finally {
              setSaving(false)
            }
          }}>
            <div className="mb-4">
              <label className="block text-xs font-black uppercase tracking-[0.1em] text-slate-400 mb-3 ml-1">Fecha límite de inscripción</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                  <span className="material-symbols-outlined text-[22px]">event</span>
                </div>
                <input
                  name="expiryDate"
                  type="date"
                  required
                  min={new Date().toISOString().split('T')[0]}
                  defaultValue={new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-bold rounded-2xl pl-12 pr-4 py-4 focus:outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all appearance-none shadow-inner"
                />
              </div>
            </div>
          </form>
        </div>
      </div>
    </Modal>
  )
}
