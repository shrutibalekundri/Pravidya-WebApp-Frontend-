import { createContext, useContext, useState, useCallback } from 'react';

const ManagementFiltersContext = createContext(null);

export function ManagementFiltersProvider({ children }) {
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    courseId: '',
    location: '',
    counselorId: '',
    institutionId: '',
    leadSource: '',
  });

  const updateFilters = useCallback((updates) => {
    setFilters((prev) => ({ ...prev, ...updates }));
  }, []);

  const params = {};
  Object.entries(filters).forEach(([k, v]) => {
    if (v) params[k] = v;
  });

  return (
    <ManagementFiltersContext.Provider value={{ filters, updateFilters, params }}>
      {children}
    </ManagementFiltersContext.Provider>
  );
}

export function useManagementFilters() {
  const ctx = useContext(ManagementFiltersContext);
  if (!ctx) return { filters: {}, updateFilters: () => {}, params: {} };
  return ctx;
}
