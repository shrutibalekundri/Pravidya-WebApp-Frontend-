/**
 * Renders a form input based on custom field configuration.
 * Supports: text, textarea, dropdown, checkbox (multi-select), email, number, url, date, time.
 */
const CustomFieldInput = ({ field, value, onChange, required = false }) => {
  const { key, label, placeholder, type: fieldType, options: fieldOptions } = field;
  const val = value ?? '';
  const handleChange = (e) => onChange(key, e.target.value);
  const handleMultiCheckboxChange = (opt, checked) => {
    const selected = Array.isArray(value) ? value : [];
    const next = checked
      ? [...selected, opt]
      : selected.filter((o) => o !== opt);
    onChange(key, next);
  };

  if (fieldType === 'checkbox' && Array.isArray(fieldOptions) && fieldOptions.length > 0) {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{label} {required && <span className="text-red-500">*</span>}</label>
        <div className="flex flex-wrap gap-3">
          {fieldOptions.map((opt) => (
            <label key={opt} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={(e) => handleMultiCheckboxChange(opt, e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-gray-700">{opt}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (fieldType === 'dropdown' && Array.isArray(fieldOptions) && fieldOptions.length > 0) {
    return (
      <>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label} {required && <span className="text-red-500">*</span>}</label>
        <select value={val} onChange={handleChange} className="input-field" required={required}>
          <option value="">Select {label}</option>
          {fieldOptions.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </>
    );
  }

  const ph = placeholder || `Enter ${label.toLowerCase()}`;

  if (fieldType === 'textarea') {
    return (
      <>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label} {required && <span className="text-red-500">*</span>}</label>
        <textarea value={val} onChange={handleChange} className="input-field w-full min-h-[80px]" placeholder={ph} required={required} rows={3} />
      </>
    );
  }

  const inputProps = {
    value: val,
    onChange: handleChange,
    className: 'input-field',
    placeholder: ph,
    required,
  };

  if (fieldType === 'email') return <><label className="block text-sm font-medium text-gray-700 mb-1">{label} {required && <span className="text-red-500">*</span>}</label><input type="email" {...inputProps} placeholder={placeholder || 'email@example.com'} /></>;
  if (fieldType === 'number') return <><label className="block text-sm font-medium text-gray-700 mb-1">{label} {required && <span className="text-red-500">*</span>}</label><input type="number" {...inputProps} /></>;
  if (fieldType === 'url') return <><label className="block text-sm font-medium text-gray-700 mb-1">{label} {required && <span className="text-red-500">*</span>}</label><input type="url" {...inputProps} placeholder={placeholder || 'https://example.com'} /></>;
  if (fieldType === 'date') return <><label className="block text-sm font-medium text-gray-700 mb-1">{label} {required && <span className="text-red-500">*</span>}</label><input type="date" {...inputProps} /></>;
  if (fieldType === 'time') return <><label className="block text-sm font-medium text-gray-700 mb-1">{label} {required && <span className="text-red-500">*</span>}</label><input type="time" {...inputProps} /></>;

  return (
    <>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label} {required && <span className="text-red-500">*</span>}</label>
      <input type="text" {...inputProps} />
    </>
  );
};

export default CustomFieldInput;
