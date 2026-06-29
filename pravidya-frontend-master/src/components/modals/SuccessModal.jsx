/**
 * 🟢 Success Modal – Import completed, shows summary.
 */
const SuccessModal = ({ open, title = 'Success', messages = [], summary = {}, onClose, primaryButton = { label: 'Close', onClick: () => {} }, secondaryButton }) => {
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="success-modal-title">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div className="relative bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col border-2 border-green-200">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-green-100 bg-green-50 rounded-t-xl">
          <span className="flex items-center justify-center w-10 h-10 rounded-full bg-green-500 text-white text-xl" aria-hidden="true">✅</span>
          <h2 id="success-modal-title" className="text-xl font-bold text-green-900">{title}</h2>
        </div>
        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
          {Object.keys(summary).length > 0 && (
            <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-900">
              {Object.entries(summary).map(([key, value]) => (
                <div key={key} className="flex justify-between gap-2">
                  <span className="font-medium">{key}</span>
                  <span>{value}</span>
                </div>
              ))}
            </div>
          )}
          {Array.isArray(messages) && messages.length > 0 ? (
            <ul className="list-disc list-inside space-y-1 text-green-800 text-sm">
              {messages.map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          ) : messages && !Array.isArray(messages) ? (
            <p className="text-green-800 text-sm">{messages}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-3 px-6 py-4 border-t border-green-100 bg-green-50/50 rounded-b-xl">
          <button type="button" onClick={handlePrimary} className="btn-primary bg-green-600 hover:bg-green-700 text-white">
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

export default SuccessModal;
