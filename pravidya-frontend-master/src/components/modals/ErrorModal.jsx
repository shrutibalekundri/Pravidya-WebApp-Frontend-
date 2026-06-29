/**
 * 🔴 Error Modal – Blocking errors, import stops, red theme.
 */
const ErrorModal = ({ open, title = 'Error', messages = [], onClose, primaryButton = { label: 'Close', onClick: () => {} }, secondaryButton }) => {
  if (!open) return null;

  const handlePrimary = () => {
    primaryButton.onClick?.();
    onClose?.();
  };

  const handleSecondary = () => {
    secondaryButton?.onClick?.();
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="error-modal-title">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div className="relative bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col border-2 border-red-200">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-red-100 bg-red-50 rounded-t-xl">
          <span className="flex items-center justify-center w-10 h-10 rounded-full bg-red-500 text-white text-xl" aria-hidden="true">❌</span>
          <h2 id="error-modal-title" className="text-xl font-bold text-red-900">{title}</h2>
        </div>
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {Array.isArray(messages) ? (
            <ul className="list-disc list-inside space-y-1 text-red-800 text-sm">
              {messages.map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          ) : (
            <p className="text-red-800 text-sm">{messages}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-3 px-6 py-4 border-t border-red-100 bg-red-50/50 rounded-b-xl">
          <button type="button" onClick={handlePrimary} className="btn-primary bg-red-600 hover:bg-red-700 text-white">
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

export default ErrorModal;
