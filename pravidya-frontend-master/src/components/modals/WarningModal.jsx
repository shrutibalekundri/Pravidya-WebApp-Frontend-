/**
 * 🟡 Warning Modal – Non-blocking, admin can continue or cancel.
 */
const WarningModal = ({ open, title = 'Warning', messages = [], onClose, onContinue, primaryButton = { label: 'Continue', onClick: () => {} }, secondaryButton }) => {
  if (!open) return null;

  const handlePrimary = () => {
    primaryButton.onClick?.();
    onContinue?.();
    onClose?.();
  };

  const handleSecondary = () => {
    secondaryButton?.onClick?.();
    // Do not auto-close so user can still click Continue
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="warning-modal-title">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div className="relative bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col border-2 border-amber-200">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-amber-100 bg-amber-50 rounded-t-xl">
          <span className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-500 text-white text-xl" aria-hidden="true">⚠️</span>
          <h2 id="warning-modal-title" className="text-xl font-bold text-amber-900">{title}</h2>
        </div>
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {Array.isArray(messages) ? (
            <ul className="list-disc list-inside space-y-1 text-amber-900 text-sm">
              {messages.map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          ) : (
            <p className="text-amber-900 text-sm">{messages}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-3 px-6 py-4 border-t border-amber-100 bg-amber-50/50 rounded-b-xl">
          <button type="button" onClick={handlePrimary} className="btn-primary bg-amber-600 hover:bg-amber-700 text-white">
            {primaryButton.label}
          </button>
          {secondaryButton && (
            <button type="button" onClick={handleSecondary} className="btn-secondary">
              {secondaryButton.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default WarningModal;
