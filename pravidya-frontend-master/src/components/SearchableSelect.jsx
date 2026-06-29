import { useState, useRef, useEffect } from 'react';

/**
 * A searchable dropdown - type to filter options, click to select.
 * When allowCustom is true, user can type a value not in the list.
 * @param {Object} props
 * @param {string} props.value - Current value
 * @param {function} props.onChange - (value) => void
 * @param {string[]} props.options - List of option values
 * @param {string} props.placeholder - Placeholder when empty
 * @param {string} props.className - CSS classes for the container/input
 * @param {boolean} props.required - Whether the field is required
 * @param {string} props.name - Input name attribute
 * @param {boolean} props.disabled - Disable the input
 * @param {boolean} props.allowCustom - Allow typing custom values not in options
 */
export default function SearchableSelect({ value, onChange, options = [], placeholder = 'Select...', className = '', required = false, name, disabled = false, allowCustom = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef(null);

  const filteredOptions = options.filter((opt) =>
    String(opt).toLowerCase().includes(query.toLowerCase().trim())
  );
  const displayOptions = query.trim()
    ? filteredOptions
    : options;
  const selectedLabel = value ? (options.find((o) => o === value) || value) : '';

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        if (allowCustom && query.trim()) onChange(query.trim());
        setIsOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [allowCustom, query]);

  const handleSelect = (opt) => {
    onChange(opt);
    setQuery('');
    setIsOpen(false);
  };

  const handleInputChange = (e) => {
    if (disabled) return;
    setQuery(e.target.value);
    if (!isOpen) setIsOpen(true);
  };

  const handleFocus = () => {
    if (disabled) return;
    setIsOpen(true);
    setQuery(value || '');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setQuery('');
      e.target.blur();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (displayOptions.length === 1) {
        handleSelect(displayOptions[0]);
      } else if (allowCustom && query.trim()) {
        onChange(query.trim());
        setQuery('');
        setIsOpen(false);
      }
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        name={name}
        value={isOpen ? query : selectedLabel}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        required={required}
        className={className}
        autoComplete="off"
        disabled={disabled}
      />
      {isOpen && (
        <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {displayOptions.length === 0 && !(allowCustom && query.trim()) ? (
            <li className="px-3 py-2 text-sm text-gray-500">No matching options</li>
          ) : (
            <>
              {allowCustom && query.trim() && !displayOptions.includes(query.trim()) && (
                <li
                  onClick={() => { onChange(query.trim()); setQuery(''); setIsOpen(false); }}
                  className="cursor-pointer px-3 py-2 text-sm text-primary-600 hover:bg-primary-50 font-medium"
                >
                  Use &quot;{query.trim()}&quot; (custom)
                </li>
              )}
              {displayOptions.map((opt) => (
                <li
                  key={opt}
                  onClick={() => handleSelect(opt)}
                  className={`cursor-pointer px-3 py-2 text-sm hover:bg-gray-100 ${
                    opt === value ? 'bg-primary-50 font-medium text-primary-700' : 'text-gray-800'
                  }`}
                >
                  {opt}
                </li>
              ))}
            </>
          )}
        </ul>
      )}
    </div>
  );
}
