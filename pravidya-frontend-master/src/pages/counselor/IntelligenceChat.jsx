import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { intelligenceAPI } from '../../services/api';

const IntelligenceChat = () => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState(null);
  const [lastQuery, setLastQuery] = useState('');

  const handleAsk = async () => {
    const q = query.trim();
    if (!q) return;

    try {
      setLoading(true);
      setAnswer('');
      setLastQuery(q);
      await intelligenceAPI.queryStream(q, {
        onChunk: (text) => setAnswer((prev) => prev + text),
      });
    } catch (err) {
      console.error(err);
      toast.error(err?.message || err?.response?.data?.message || 'Query failed');
      setAnswer(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Intelligence Chat</h1>
        <p className="text-slate-600">
          Ask questions based on the content uploaded by the admin. The engine will search the
          trained documents and show the most relevant passages.
        </p>
      </div>

      <div className="flex gap-2">
        <input
          className="flex-1 border rounded px-3 py-2"
          placeholder="Ask a question about the academy content…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleAsk();
            }
          }}
        />
        <button
          type="button"
          onClick={handleAsk}
          disabled={loading}
          className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-60"
        >
          {loading ? 'Searching…' : 'Ask'}
        </button>
      </div>

      <div className="border rounded-lg bg-white p-4 max-h-80 overflow-y-auto space-y-4">
        {answer === null && !loading && (
          <p className="text-sm text-slate-500">
            No results yet. Ask a question above to search the trained content.
          </p>
        )}
        {(answer !== null || loading) && (
          <div className="border rounded-md p-3 bg-slate-50">
            {lastQuery && (
              <p className="text-xs text-slate-500 mb-1">Question: {lastQuery}</p>
            )}
            <p className="text-sm text-slate-800 whitespace-pre-wrap">
              {answer || (loading ? 'Searching and generating answer…' : '')}
            </p>
            {loading && answer && (
              <span className="inline-block w-2 h-4 ml-0.5 bg-slate-600 animate-pulse" aria-hidden />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default IntelligenceChat;

