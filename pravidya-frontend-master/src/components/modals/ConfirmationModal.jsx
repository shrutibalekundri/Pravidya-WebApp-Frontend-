/**
 * 🔵 Confirmation Modal – Duplicate handling choices (Update / Import as New / Skip).
 */
const ConfirmationModal = ({
  open,
  title = 'Duplicate Lead Detected',
  parentPhone,
  studentName,
  course,
  onUpdateExisting,
  onImportAsNew,
  onSkip,
  onClose,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full border-2 border-blue-200">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-blue-100 bg-blue-50 rounded-t-xl">
          <span className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-500 text-white text-xl" aria-hidden="true">⚠️</span>
          <h2 id="confirm-modal-title" className="text-xl font-bold text-blue-900">{title}</h2>
        </div>
        <div className="px-6 py-4 text-sm text-gray-800 space-y-2">
          <p><span className="font-medium">Parent Phone:</span> {parentPhone}</p>
          <p><span className="font-medium">Student:</span> {studentName}</p>
          <p><span className="font-medium">Course:</span> {course}</p>
          <p className="pt-2 text-gray-600">Choose action:</p>
        </div>
        <div className="flex flex-col gap-2 px-6 py-4 border-t border-blue-100 bg-blue-50/50 rounded-b-xl">
          <button type="button" onClick={() => { onUpdateExisting?.(); onClose?.(); }} className="btn-primary bg-blue-600 hover:bg-blue-700 text-white w-full">
            🔁 Update Existing Lead
          </button>
          <button type="button" onClick={() => { onImportAsNew?.(); onClose?.(); }} className="btn-secondary w-full">
            ➕ Import as New Lead
          </button>
          <button type="button" onClick={() => { onSkip?.(); onClose?.(); }} className="border border-gray-300 rounded-lg px-4 py-2 text-gray-700 hover:bg-gray-100 w-full">
            ⏭️ Skip This Row
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
