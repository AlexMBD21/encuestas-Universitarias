import React from 'react';
import { Modal } from '../../../components/ui/Modal';
import ButtonLoader from '../../../components/ButtonLoader';

export const GenerateSatisfaccionLinkModal = ({ isOpen, onClose, survey, dataClientNow, onSave }: any) => {
  const [saving, setSaving] = React.useState(false);

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md" hideMobileIndicator={true} scrollableBody={false}>
      <div className="bg-white dark:bg-slate-900 rounded-t-[2rem] sm:rounded-2xl flex flex-col h-full sm:max-h-[85vh] relative overflow-hidden">
        {/* Drag handle mobile */}
        <div className="w-full flex justify-center pt-2 pb-1 sm:hidden absolute top-0 z-20 cursor-pointer" style={{ touchAction: 'none' }} onClick={onClose}>
          <div className="w-12 h-1.5 rounded-full bg-slate-900/40 dark:bg-white/30"></div>
        </div>

        <div className="modal-scrollable-content px-6 py-5 sm:p-8 flex-1 overflow-y-auto overscroll-contain pb-10">
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm shrink-0">
                <span className="material-symbols-outlined text-[26px]">calendar_month</span>
              </div>
              <span>Establecer Fecha Límite</span>
            </h3>

            <p className="text-[15px] text-slate-500 dark:text-slate-400 mb-8 leading-relaxed font-medium pl-1 mt-4">
              Guarda la fecha máxima de inscripción para habilitar el enlace público.
            </p>

          <form onSubmit={async (e) => {
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

            // Always generate a fresh random token for the satisfaction survey so old links become invalid
            const token = `sat_${Math.random().toString(36).substring(2, 10)}_${Math.random().toString(36).substring(2, 10)}`

            setSaving(true)
            try {
              const updated = { ...survey, satisfaccionToken: token, satisfaccionExpiresAt: expires }
              await (dataClientNow as any).setSurvey(String(survey.id), updated)
              onSave(updated)
            } finally {
              setSaving(false)
            }
          }}>
            <div className="mb-8">
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
                  defaultValue={
                    survey?.satisfaccionExpiresAt 
                      ? new Date(survey.satisfaccionExpiresAt).toISOString().split('T')[0]
                      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                  }
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-bold rounded-2xl pl-12 pr-4 py-4 focus:outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all appearance-none shadow-inner"
                />
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 shrink-0">
              <button disabled={saving} type="submit" className="btn btn-primary px-10">
                {saving ? <><ButtonLoader size={20} /> Guardando...</> : <><span className="material-symbols-outlined text-[20px]">save</span> Guardar Fecha</>}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Modal>
  )
}
