import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { counselorAPI } from '../../services/api';
import { Download } from 'lucide-react';
import toast from 'react-hot-toast';

const MAX_SCORE = 100;

function analyzeNotes(textRaw) {
  const text = (textRaw || '').toLowerCase();
  if (!text.trim()) {
    return null;
  }

  let score = 50;

  const add = (n) => {
    score += n;
  };

  const containsAny = (words) => words.some((w) => text.includes(w));

  // Career motivation / future goals
  if (
    containsAny([
      'career',
      'job',
      'placement',
      'placements',
      'future',
      'growth',
      'promotion',
      'abroad',
      'ms in',
      'mba',
      'engineer',
      'doctor',
    ])
  ) {
    add(20);
  }

  // Job security concern
  if (containsAny(['secure job', 'job security', 'government job', 'stable job', 'stability'])) {
    add(15);
  }

  // Urgency signals
  const hasUrgency = containsAny([
    'this year',
    'this intake',
    'immediately',
    'as soon as possible',
    'next month',
    'next 1 month',
    'last date',
    'deadline',
  ]);
  if (hasUrgency) {
    add(20);
  }

  // Active engagement
  if (
    containsAny([
      'asked about',
      'many questions',
      'clarified',
      'detailed discussion',
      'wanted to understand',
      'compared colleges',
    ])
  ) {
    add(10);
  }

  // Parental involvement
  const parentWords = ['parent', 'mother', 'father', 'guardian'];
  const hasParent = containsAny(parentWords);
  if (hasParent) {
    add(10);
  }

  // Clear goal or course interest
  if (
    containsAny([
      'wants to join',
      'wants admission in',
      'interested in',
      'specific course',
      'cse',
      'ece',
      'bca',
      'bba',
      'mbbs',
    ])
  ) {
    add(10);
  }

  // Financial objections
  const strongFinancial = containsAny([
    'fees are high',
    'too expensive',
    'cannot afford',
    'fee is high',
    'high fees',
  ]);
  if (strongFinancial) {
    add(-5);
  }

  // Uncertainty / confusion
  const confused = containsAny(['confused', 'not sure', 'unsure', 'no clarity', 'exploring options only']);
  if (confused) {
    add(-10);
  }

  // Low engagement
  const lowEngagement = containsAny([
    'not very interested',
    'low interest',
    'disinterested',
    'call was short',
    'not responsive',
  ]);
  if (lowEngagement) {
    add(-10);
  }

  score = Math.max(0, Math.min(MAX_SCORE, Math.round(score)));

  // Classification (keep internal labels but we'll show as intent strength in UI)
  let leadTemperature = 'Cold';
  if (score >= 70) leadTemperature = 'Hot';
  else if (score >= 40) leadTemperature = 'Warm';

  // Derived fields
  let primaryHook = 'Exploring better opportunities';
  if (containsAny(['career', 'job', 'placement', 'future', 'growth'])) {
    primaryHook = 'Career growth and job security';
  } else if (hasParent && containsAny(['wants best for', 'for my child', 'for her future'])) {
    primaryHook = 'Parental aspiration for better future';
  } else if (strongFinancial) {
    primaryHook = 'Financial concern and affordability';
  } else if (hasUrgency) {
    primaryHook = 'Fear of missing this year\'s opportunity';
  }

  // Pain points & motivation drivers
  const pain_points = [];
  const motivation_drivers = [];
  const objections_or_concerns = [];

  if (strongFinancial) {
    pain_points.push('Concerned about high fees and affordability');
    objections_or_concerns.push('Strong objection related to course fees');
  }
  if (containsAny(['not sure which course', 'confused about course', 'course confusion'])) {
    pain_points.push('Confused about which course to choose');
  }
  if (containsAny(['distance', 'far from home'])) {
    pain_points.push('Worried about distance or location of college');
  }
  if (containsAny(['placement', 'placements', 'package'])) {
    motivation_drivers.push('Wants strong placements and packages');
  }
  if (hasUrgency) {
    motivation_drivers.push('Wants to secure admission in upcoming intake');
  }
  if (containsAny(['reputed college', 'top college', 'ranking'])) {
    motivation_drivers.push('Prefers reputed / well-ranked institution');
  }

  // Urgency level
  let urgency_level = 'Medium';
  if (hasUrgency) urgency_level = 'High';
  else if (containsAny(['next year', 'no hurry', 'just exploring'])) urgency_level = 'Low';

  // Decision authority
  let decision_authority = 'Student';
  if (hasParent && containsAny(['parent will decide', 'father will decide', 'mother will decide'])) {
    decision_authority = 'Parent';
  } else if (hasParent) {
    decision_authority = 'Both';
  }

  // Financial sensitivity
  let financial_sensitivity = 'Medium';
  if (strongFinancial || containsAny(['loan', 'education loan', 'scholarship'])) {
    financial_sensitivity = 'High';
  } else if (containsAny(['fees not an issue', 'budget is flexible'])) {
    financial_sensitivity = 'Low';
  }

  const summaryParts = [];
  summaryParts.push(
    `Lead shows a ${leadTemperature.toLowerCase()} temperature with an emotional intent score of ${score}/100.`
  );
  summaryParts.push(`Primary emotional hook appears to be ${primaryHook.toLowerCase()}.`);
  if (financial_sensitivity === 'High') {
    summaryParts.push('Family is quite sensitive to fees, so financial planning and scholarships will be important.');
  }
  const emotional_summary = summaryParts.join(' ');

  return {
    primary_emotional_hook: primaryHook,
    pain_points,
    motivation_drivers,
    objections_or_concerns,
    urgency_level,
    decision_authority,
    financial_sensitivity,
    emotional_summary,
    emotional_intent_score: score,
    lead_temperature: leadTemperature,
  };
}

export default function EmotionalHookAnalytics() {
  const { user } = useAuth();
  const [assignedLeads, setAssignedLeads] = useState([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [notesText, setNotesText] = useState('');
  const [fileName, setFileName] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const counselorId = user?.counselorProfile?.id ?? user?.counselorProfile?._id;
    if (!counselorId) return;
    setLoadingLeads(true);
    counselorAPI
      .getLeads(counselorId)
      .then((res) => {
        setAssignedLeads(res.data?.data?.leads || []);
      })
      .catch(() => {
        setAssignedLeads([]);
      })
      .finally(() => setLoadingLeads(false));
  }, [user?.counselorProfile?.id, user?.counselorProfile?._id]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    if (file.type === 'text/plain') {
      const reader = new FileReader();
      reader.onload = () => {
        setNotesText(String(reader.result || ''));
      };
      reader.readAsText(file);
    } else {
      // For PDF/DOCX, just note that backend/extractor should be wired later.
      setNotesText(
        `Call notes uploaded from file: ${file.name}. Please connect backend text extraction for full AI analysis.`
      );
    }
  };

  const handleAnalyze = () => {
    if (!notesText.trim()) {
      toast.error('Please upload or paste call notes first');
      return;
    }
    setIsAnalyzing(true);
    try {
      const result = analyzeNotes(notesText);
      if (!result) {
        toast.error('Could not analyze notes');
        return;
      }
      setAnalysis(result);
      toast.success('Emotional hook analyzed');
    } catch (err) {
      toast.error('Failed to analyze notes');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSave = () => {
    if (!analysis) {
      toast.error('Run analysis first');
      return;
    }
    if (!selectedLeadId) {
      toast.error('Select a lead to save analysis');
      return;
    }
    setSaving(true);
    try {
      const key = `emotional_hook_analysis_${selectedLeadId}`;
      localStorage.setItem(key, JSON.stringify(analysis));
      toast.success('Analysis saved locally for this lead');
    } catch (err) {
      toast.error('Failed to save analysis');
    } finally {
      setSaving(false);
    }
  };

  const selectedLead =
    assignedLeads.find((l) => l.id === selectedLeadId) ||
    assignedLeads.find((l) => l.leadId === selectedLeadId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Emotional Hook Analytics</h1>
          <p className="text-sm text-slate-600 mt-1">
            Analyze call notes to understand emotional motivation, seriousness, and conversion potential for each lead.
          </p>
        </div>
      </div>

      {/* Lead Data Input */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-soft p-5 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900 mb-1">Lead Data Input</h2>
        <p className="text-sm text-slate-600 mb-3">
          Select an assigned lead (optional) and upload or paste call notes from your counselling conversation.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">Select Lead (optional)</label>
            <select
              value={selectedLeadId}
              onChange={(e) => setSelectedLeadId(e.target.value)}
              className="input-field w-full"
            >
              <option value="">
                {loadingLeads ? 'Loading leads...' : assignedLeads.length === 0 ? 'No assigned leads' : 'Select lead'}
              </option>
              {assignedLeads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.studentName || lead.parentName || 'Lead'} ({lead.leadId || lead.id})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2 flex flex-col gap-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Upload Lead Call Notes</label>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <label className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg border border-slate-300 bg-slate-50 text-sm font-medium text-slate-700 hover:bg-slate-100 cursor-pointer">
                <input type="file" accept=".txt,.pdf,.doc,.docx" className="hidden" onChange={handleFileChange} />
                <Download className="w-4 h-4 mr-2" />
                Upload Lead Call Notes
              </label>
              {fileName && <span className="text-xs text-slate-500 truncate max-w-xs">Selected: {fileName}</span>}
            </div>
            <p className="text-xs text-slate-500">
              Supported formats: PDF, DOCX, TXT. For PDF/DOCX, text extraction will need backend integration for
              production use.
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Or paste call notes directly</label>
          <textarea
            rows={6}
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
            className="input-field w-full font-mono text-sm"
            placeholder="Paste detailed call notes or transcript here..."
          />
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="btn-primary px-6 py-2.5 disabled:opacity-60"
          >
            {isAnalyzing ? 'Analyzing…' : 'Analyze Emotional Hook'}
          </button>
        </div>
      </div>

      {/* Results Dashboard */}
      {analysis && (
        <div className="space-y-4">
          {/* Score & Temperature */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-soft p-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700 mb-1">Lead Emotional Intent Score</p>
                <p className="text-4xl font-extrabold text-primary-600">
                  {analysis.emotional_intent_score}
                  <span className="text-lg text-slate-500"> / {MAX_SCORE}</span>
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Based on motivation, urgency, engagement and financial discussion in the call notes.
                </p>
              </div>
              <div className="relative w-20 h-20">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-slate-200"
                    stroke="currentColor"
                    strokeWidth="3.8"
                    fill="none"
                    d="M18 2.0845
                       a 15.9155 15.9155 0 0 1 0 31.831
                       a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className={
                      analysis.lead_temperature === 'Hot'
                        ? 'text-emerald-500'
                        : analysis.lead_temperature === 'Warm'
                        ? 'text-amber-400'
                        : 'text-red-400'
                    }
                    stroke="currentColor"
                    strokeWidth="3.8"
                    strokeDasharray={`${(analysis.emotional_intent_score / MAX_SCORE) * 100}, 100`}
                    fill="none"
                    d="M18 2.0845
                       a 15.9155 15.9155 0 0 1 0 31.831
                       a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[11px] font-semibold text-slate-700 text-center">
                    {analysis.lead_temperature === 'Hot'
                      ? 'Strong intent'
                      : analysis.lead_temperature === 'Warm'
                      ? 'Medium intent'
                      : 'Low intent'}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-soft p-5 space-y-2">
              <p className="text-sm font-medium text-slate-700">Emotional Hook</p>
              <p className="text-sm text-slate-800">
                {analysis.primary_emotional_hook || 'Detected from call notes'}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-100">
                  Urgency: {analysis.urgency_level || 'Unknown'}
                </span>
                <span className="px-2 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-100">
                  Decision: {analysis.decision_authority || 'Unknown'}
                </span>
                <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                  Financial: {analysis.financial_sensitivity || 'Unknown'}
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-soft p-5 space-y-2">
              <p className="text-sm font-medium text-slate-700">Emotional Summary</p>
              <p className="text-sm text-slate-800">
                {analysis.emotional_summary ||
                  'Short emotional summary of the lead motivation and concerns based on the call notes.'}
              </p>
            </div>
          </div>

          {/* Detailed cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-soft p-5">
              <p className="text-sm font-semibold text-slate-800 mb-2">Pain Points</p>
              {analysis.pain_points && analysis.pain_points.length > 0 ? (
                <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">
                  {analysis.pain_points.map((p, idx) => (
                    <li key={idx}>{p}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">No clear pain points detected.</p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-soft p-5">
              <p className="text-sm font-semibold text-slate-800 mb-2">Motivation Drivers</p>
              {analysis.motivation_drivers && analysis.motivation_drivers.length > 0 ? (
                <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">
                  {analysis.motivation_drivers.map((p, idx) => (
                    <li key={idx}>{p}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">No strong motivation drivers extracted.</p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-soft p-5">
              <p className="text-sm font-semibold text-slate-800 mb-2">Objections / Concerns</p>
              {analysis.objections_or_concerns && analysis.objections_or_concerns.length > 0 ? (
                <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">
                  {analysis.objections_or_concerns.map((p, idx) => (
                    <li key={idx}>{p}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">No explicit objections detected.</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !analysis}
              className="btn-primary px-6 py-2.5 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save Analysis to Lead Profile'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

