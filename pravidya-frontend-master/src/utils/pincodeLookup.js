/**
 * Fetches city (district) and state options from Indian Postal API based on pincode.
 * API: https://api.postalpincode.in/pincode/{pincode}
 * Returns unique State and District (city) values.
 */
export async function fetchLocationByPincode(pincode) {
  const trimmed = String(pincode || '').trim();
  if (trimmed.length !== 6 || !/^\d{6}$/.test(trimmed)) {
    return { cities: [], states: [], error: 'Enter a valid 6-digit pincode' };
  }
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${trimmed}`, {
      headers: { Accept: 'application/json' },
    });
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      return { cities: [], states: [], error: 'No data found for this pincode' };
    }
    const first = data[0];
    if (first.Status !== 'Success' || !Array.isArray(first.PostOffice) || first.PostOffice.length === 0) {
      return { cities: [], states: [], error: first.Message || 'No data found for this pincode' };
    }
    const states = [...new Set(first.PostOffice.map((p) => p.State).filter(Boolean))].sort();
    const cities = [...new Set(first.PostOffice.map((p) => p.District || p.Block || p.Name).filter(Boolean))].sort();
    return { cities, states, error: null };
  } catch (err) {
    return { cities: [], states: [], error: err?.message || 'Failed to fetch location' };
  }
}
