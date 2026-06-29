import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import axios from 'axios';

const API_BASE = import.meta.env.DEV ? '/api' : (import.meta.env.VITE_API_URL || '/api');

const CaptchaInput = ({
  captchaId,
  setCaptchaId,
  captchaText,
  setCaptchaText,
  disabled = false,
  error,
  initialImage,
  onRefresh,
}) => {
  const [image, setImage] = useState(initialImage ?? null);
  const [loading, setLoading] = useState(!initialImage);
  const [fetchError, setFetchError] = useState(null);
  const initialFetchDone = useRef(false);

  const fetchCaptcha = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    setCaptchaText('');
    if (onRefresh) {
      try {
        await onRefresh();
      } catch {
        setFetchError('Cannot connect. Start the backend server (port 8000).');
      } finally {
        setLoading(false);
      }
      return;
    }
    setFetchError(null);
    setCaptchaText('');
    try {
      const res = await axios.get(`${API_BASE}/auth/captcha`, { timeout: 10000 });
      const { captchaId: id, image: img } = res.data?.data || res.data || {};
      setCaptchaId(id || '');
      setImage(img || null);
    } catch (err) {
      const msg = err.response?.data?.message
        || (err.code === 'ECONNABORTED' ? 'Request timed out. Is the backend running?' : null)
        || (err.code === 'ERR_NETWORK' ? 'Cannot connect. Start the backend server (port 8000).' : null)
        || 'Failed to load captcha';
      setFetchError(msg);
      setImage(null);
      setCaptchaId('');
    } finally {
      setLoading(false);
    }
  }, [setCaptchaId, setCaptchaText, onRefresh]);

  useEffect(() => {
    if (initialImage) {
      setImage(initialImage);
      setLoading(false);
    } else if (!initialFetchDone.current) {
      initialFetchDone.current = true;
      fetchCaptcha();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial fetch only once
  }, [initialImage]);

  useEffect(() => {
    if (initialImage) {
      setImage(initialImage);
      setLoading(false);
    }
  }, [initialImage]);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-800">Captcha</label>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 rounded-lg border border-gray-200 bg-gray-50 p-1 min-w-[180px] min-h-[60px] flex items-center justify-center">
          {loading ? (
            <div className="w-[180px] h-[60px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent" />
            </div>
          ) : fetchError ? (
            <p className="text-sm text-red-600">{fetchError}</p>
          ) : image ? (
            <img src={image} alt="Captcha" className="max-w-[180px] h-[60px] object-contain rounded" />
          ) : null}
        </div>
        <button
          type="button"
          onClick={fetchCaptcha}
          disabled={loading || disabled}
          className="flex-shrink-0 inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg border border-gray-200 disabled:opacity-50"
          title="Refresh captcha"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>
      <input
        type="text"
        value={captchaText}
        onChange={(e) => setCaptchaText(e.target.value)}
        placeholder="Enter captcha"
        disabled={disabled}
        autoComplete="off"
        className="w-full pl-4 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800 placeholder-gray-400"
      />
      {(error || fetchError) && (
        <p className="text-sm text-red-600">{error || fetchError}</p>
      )}
    </div>
  );
};

export default CaptchaInput;
