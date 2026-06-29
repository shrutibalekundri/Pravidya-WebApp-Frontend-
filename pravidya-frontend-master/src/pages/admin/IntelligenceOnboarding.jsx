import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { intelligenceAPI } from '../../services/api';

const IntelligenceOnboarding = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [training, setTraining] = useState(null);
  const [sources, setSources] = useState([]);
  const [loadingSources, setLoadingSources] = useState(true);

  const fetchSources = () => {
    setLoadingSources(true);
    intelligenceAPI
      .getSources()
      .then((res) => {
        setSources(res.data?.data?.sources || []);
      })
      .catch(() => setSources([]))
      .finally(() => setLoadingSources(false));
  };

  useEffect(() => {
    fetchSources();
  }, []);

  const handleFileChange = (e) => {
    setFile(e.target.files?.[0] || null);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error('Please select a file');
      return;
    }

    try {
      setUploading(true);
      const res = await intelligenceAPI.upload(file);
      const source = res.data.data;
      toast.success(`Uploaded: ${source.fileName}`);
      fetchSources();
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.message || 'Upload failed';
      const isDuplicate = err?.response?.status === 409 || err?.response?.data?.code === 'DUPLICATE_CONTENT';
      toast.error(isDuplicate ? 'This file or content has already been uploaded.' : msg);
    } finally {
      setUploading(false);
    }
  };

  const handleTrain = async (sourceId) => {
    if (!sourceId) {
      toast.error('Select a dataset to train');
      return;
    }

    try {
      setTraining(sourceId);
      const res = await intelligenceAPI.train(sourceId);
      toast.success(
        `Learning complete. Chunks created: ${res.data?.data?.chunksCreated ?? res.data?.chunksCreated ?? 'N/A'}`
      );
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || 'Training failed');
    } finally {
      setTraining(null);
    }
  };

  const handleView = async (sourceId) => {
    if (!sourceId) return;
    try {
      const res = await intelligenceAPI.viewSource(sourceId);
      const blob = res.data;
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      console.error(err);
      let message = 'Could not open document';
      const data = err?.response?.data;
      if (data instanceof Blob) {
        try {
          const text = await data.text();
          const json = JSON.parse(text);
          if (json?.message) message = json.message;
        } catch (_) {}
      } else if (data?.message) {
        message = data.message;
      }
      toast.error(message);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Central Intelligence Onboarding</h1>
        <p className="text-gray-600">
          Upload academy PDFs, CSVs, text or DOCX files and train the intelligence engine.
        </p>
      </div>

      <form onSubmit={handleUpload} className="space-y-4 max-w-md">
        <div>
          <label className="block text-sm font-medium mb-1">
            Dataset file (PDF, CSV, TXT, DOCX)
          </label>
          <input
            type="file"
            accept=".pdf,.csv,.txt,.docx"
            onChange={handleFileChange}
            className="block w-full border rounded px-3 py-2"
          />
        </div>

        <button
          type="submit"
          disabled={uploading}
          className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-60"
        >
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
      </form>

      <div className="border rounded-lg p-4 max-w-2xl">
        <h2 className="text-sm font-semibold mb-3">Uploaded datasets</h2>
        {loadingSources ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : sources.length === 0 ? (
          <p className="text-sm text-gray-500">No dataset uploaded yet.</p>
        ) : (
          <ul className="space-y-2">
            {sources.map((src) => (
              <li
                key={src.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-gray-100 last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 truncate">{src.fileName}</p>
                  <p className="text-xs text-gray-500">
                    Uploaded {src.createdAt ? new Date(src.createdAt).toLocaleString() : ''} · {src.fileType || '—'}
                  </p>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleView(src.id)}
                    className="px-3 py-1.5 rounded border border-gray-300 text-gray-700 text-sm hover:bg-gray-50"
                  >
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTrain(src.id)}
                    disabled={training !== null}
                    className="px-3 py-1.5 rounded bg-green-600 text-white text-sm disabled:opacity-60 hover:bg-green-700"
                  >
                    {training === src.id ? 'Learning…' : 'Learn from this'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default IntelligenceOnboarding;

