import { useState, useRef, useEffect } from 'react';

/** Parse comma-separated string to array (trimmed, no empty) */
function parseValue(val) {
  if (!val || typeof val !== 'string') return [];
  return val.split(',').map((s) => s.trim()).filter(Boolean);
}

/** Join array to comma-separated string */
function stringifyValue(arr) {
  return Array.isArray(arr) ? arr.join(', ') : '';
}

/**
 * Searchable multi-select dropdown - select multiple options, type to filter.
 * Value stored as comma-separated string.
 * @param {Object} props
 * @param {string} props.value - Current value (comma-separated)
 * @param {function} props.onChange - (value: string) => void
 * @param {string[]} props.options - List of option values
 * @param {string} props.placeholder - Placeholder when empty
 * @param {string} props.className - CSS classes for the container
 * @param {boolean} props.required - Whether at least one selection is required
 * @param {string} props.name - Hidden input name for form
 * @param {boolean} props.disabled - Disable the input
 * @param {boolean} props.allowCustom - Allow typing custom values
 */
export default function SearchableMultiSelect({ value, onChange, options = [], placeholder = 'Select...', className = '', required = false, name, disabled = false, allowCustom = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const selected = parseValue(value);
  const filteredOptions = options.filter((opt) =>
    String(opt).toLowerCase().includes(query.toLowerCase().trim())
  );
  const displayOptions = query.trim() ? filteredOptions : options;
  const unselectedOptions = displayOptions.filter((o) => !selected.includes(o));

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        if (allowCustom && query.trim() && !selected.includes(query.trim())) {
          onChange(stringifyValue([...selected, query.trim()]));
        }
        setIsOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [allowCustom, query, selected]);

  const handleAdd = (opt) => {
    if (selected.includes(opt)) return;
    onChange(stringifyValue([...selected, opt]));
    setQuery('');
    if (unselectedOptions.length <= 1) setIsOpen(false);
  };

  const handleRemove = (opt) => {
    onChange(stringifyValue(selected.filter((s) => s !== opt)));
  };

  const handleInputChange = (e) => {
    if (disabled) return;
    setQuery(e.target.value);
    if (!isOpen) setIsOpen(true);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setQuery('');
      inputRef.current?.blur();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (unselectedOptions.length === 1) {
        handleAdd(unselectedOptions[0]);
      } else if (allowCustom && query.trim() && !selected.includes(query.trim())) {
        onChange(stringifyValue([...selected, query.trim()]));
        setQuery('');
      }
    }
  };

  return (
    <div ref={containerRef} className={`relative min-h-[38px] ${className}`}>
      <div
        onClick={() => !disabled && inputRef.current?.focus()}
        className={`flex flex-wrap gap-2 items-center min-h-[38px] px-3 py-2 rounded-lg border border-gray-300 bg-white focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500 ${disabled ? 'cursor-not-allowed bg-gray-50 opacity-75' : 'cursor-text'}`}
      >
        {selected.map((opt) => (
          <span
            key={opt}
            className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-primary-100 text-primary-800 text-sm"
          >
            {opt}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleRemove(opt); }}
                className="p-0.5 rounded-full hover:bg-primary-200 text-primary-600"
                aria-label={`Remove ${opt}`}
              >
                ×
              </button>
            )}
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => !disabled && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={selected.length === 0 ? placeholder : 'Add more...'}
          disabled={disabled}
          className="flex-1 min-w-[120px] outline-none py-1 text-sm"
          autoComplete="off"
        />
      </div>
      <input type="hidden" name={name} value={value} required={required} />
      {isOpen && (
        <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {unselectedOptions.length === 0 && !(allowCustom && query.trim() && !selected.includes(query.trim())) ? (
            <li className="px-3 py-2 text-sm text-gray-500">No more options</li>
          ) : (
            <>
              {allowCustom && query.trim() && !selected.includes(query.trim()) && (
                <li
                  onClick={() => { onChange(stringifyValue([...selected, query.trim()])); setQuery(''); }}
                  className="cursor-pointer px-3 py-2 text-sm text-primary-600 hover:bg-primary-50 font-medium"
                >
                  Add &quot;{query.trim()}&quot; (custom)
                </li>
              )}
              {unselectedOptions.map((opt) => (
                <li
                  key={opt}
                  onClick={() => handleAdd(opt)}
                  className="cursor-pointer px-3 py-2 text-sm hover:bg-gray-100 text-gray-800"
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
