import { useState, useEffect, useCallback } from 'react';
import { leadAPI, counselorAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';
import { VOICE_CALL_OPTIONS_FALLBACK } from '../../data/voiceCallOptionsFallback';
import { Download } from 'lucide-react';
import { downloadCallNotes } from '../../utils/downloadCallNotes';

const STEPS = [
  'Basic Details',
  'Academic Discussion',
  'Loan Requirement',
  'Decision Analysis',
  'Lead Qualification',
  'Call Summary & Follow-up',
];

function DropdownField({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select value={value || ''} onChange={(e) => onChange(e.target.value)} className="input-field w-full">
        <option value="">Select</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

const MASTER_CATEGORIES = [
  'passing_year',
  'entrance_exam',
  'gap_year',
  'gap_year_reason',
  'academic_confidence',
  'entrance_exam_preparation',
  'course_clarity',
  'preferred_college_type',
  'eligibility_concern',
  'seriousness_studies',
  'academic_performance_band',
  'entrance_score_band',
  'loan_required',
  'family_budget',
  'financial_planning',
  'loan_willingness',
  'scholarship_interest',
  'fee_sensitivity',
  'financial_dependency',
  'admission_timeline',
  'admission_urgency',
  'contacted_other_colleges',
  'talking_to_other_consultants',
  'major_concern',
  'trust_counselling',
  'parent_concerns',
  'external_influences',
  'decision_drivers',
  'lead_temperature',
  'priority_level',
  'admission_seriousness',
  'student_motivation',
  'parent_involvement',
  'likelihood_joining',
  'competition_consultants',
  'counsellor_assessment',
  'follow_up_mode',
];

/** Build structured call summary document from dropdown form data (no manual typing required). */
function buildStructuredCallSummary(form) {
  const s2 = form.step2 || {};
  const s3 = form.step3 || {};
  const s4 = form.step4 || {};
  const s5 = form.step5 || {};
  const lines = [
    '——— Counselling Call Summary ———',
    '',
    'Student / Academic Discussion',
    `• Passing Year: ${s2.passingYear || '—'}`,
    `• Academic Performance: ${s2.academicPerformanceBand || '—'}`,
    `• Academic Confidence: ${s2.academicConfidence || '—'}`,
    `• Entrance Exam: ${s2.entranceExam || '—'}`,
    `• Entrance Score: ${s2.entranceScoreBand || '—'}`,
    `• Entrance Exam Preparation: ${s2.entranceExamPreparation || '—'}`,
    `• Course Clarity: ${s2.courseClarity || '—'}`,
    `• Preferred College Type: ${s2.preferredCollegeType || '—'}`,
    `• Eligibility Concern: ${s2.eligibilityConcern || '—'}`,
    `• Gap Year: ${s2.gapYear || '—'}${s2.gapYear === 'Yes' && s2.gapYearReason ? ` (${s2.gapYearReason})` : ''}`,
    `• Seriousness Toward Studies: ${s2.seriousnessStudies || '—'}`,
    '',
    'Financial / Loan Requirement',
    `• Loan Required: ${s3.loanRequired || '—'}`,
    `• Family Budget: ${s3.familyBudget || '—'}`,
    `• Financial Planning: ${s3.financialPlanning || '—'}`,
    `• Loan Willingness: ${s3.loanWillingness || '—'}`,
    `• Scholarship Interest: ${s3.scholarshipInterest || '—'}`,
    `• Fee Sensitivity: ${s3.feeSensitivity || '—'}`,
    `• Financial Dependency: ${s3.financialDependency || '—'}`,
    '',
    'Decision Analysis',
    `• Admission Timeline: ${s4.admissionTimeline || '—'}`,
    `• Admission Urgency: ${s4.admissionUrgency || '—'}`,
    `• Contacted Other Colleges: ${s4.contactedOtherColleges || '—'}`,
    `• Talking to Other Consultants: ${s4.talkingToOtherConsultants || '—'}`,
    `• Major Concern: ${s4.majorConcern || '—'}`,
    `• Trust in Counselling: ${s4.trustCounselling || '—'}`,
    `• Parent Concerns: ${s4.parentConcerns || '—'}`,
    `• External Influences: ${s4.externalInfluences || '—'}`,
    `• Decision Drivers: ${s4.decisionDrivers || '—'}`,
    '',
    'Lead Qualification',
    `• Lead Temperature: ${s5.leadTemperature || '—'}`,
    `• Conversion Probability: ${s5.conversionProbability != null ? s5.conversionProbability + '%' : '—'}`,
    `• Priority Level: ${s5.priorityLevel || '—'}`,
    `• Admission Seriousness: ${s5.admissionSeriousness || '—'}`,
    `• Student Motivation: ${s5.studentMotivation || '—'}`,
    `• Parent Involvement: ${s5.parentInvolvement || '—'}`,
    `• Likelihood of Joining: ${s5.likelihoodJoining || '—'}`,
    `• Competition from Other Consultants: ${s5.competitionConsultants || '—'}`,
    `• Counsellor Assessment: ${s5.counsellorAssessment || '—'}`,
  ];
  return lines.join('\n');
}

export default function VoiceCallLeadUpdateWizard({ onClose, assignedLeads: leadsProp = [] }) {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [assignedLeads, setAssignedLeads] = useState(leadsProp);
  const [lead, setLead] = useState(null);
  const [loadingLead, setLoadingLead] = useState(false);
  const [loadingLeads, setLoadingLeads] = useState(!leadsProp.length);
  const [masterOptions, setMasterOptions] = useState({});
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [callHistory, setCallHistory] = useState([]);
  const [skipped, setSkipped] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [justSavedSummary, setJustSavedSummary] = useState(null);

  const [form, setForm] = useState({
    step1: {},
    step2: {},
    step3: {},
    step4: {},
    step5: {},
    step6: { callSummary: '', followUpRequired: false, followUpDateTime: '', followUpMode: '' },
  });

  const fetchMasterOptions = useCallback(async () => {
    setLoadingOptions(true);
    try {
      const res = await counselorAPI.voiceCall.getMasterOptions(MASTER_CATEGORIES);
      const fromApi = res.data?.data || {};
      setMasterOptions({ ...VOICE_CALL_OPTIONS_FALLBACK, ...fromApi });
    } catch {
      setMasterOptions(VOICE_CALL_OPTIONS_FALLBACK);
      toast.error('Failed to load form options; using defaults');
    } finally {
      setLoadingOptions(false);
    }
  }, []);

  useEffect(() => {
    fetchMasterOptions();
  }, [fetchMasterOptions]);

  useEffect(() => {
    if (leadsProp.length > 0) {
      setAssignedLeads(leadsProp);
      setLoadingLeads(false);
      return;
    }
    const counselorId = user?.counselorProfile?.id ?? user?.counselorProfile?._id;
    if (!counselorId) {
      setLoadingLeads(false);
      return;
    }
    setLoadingLeads(true);
    counselorAPI.getLeads(counselorId)
      .then((res) => {
        const list = res.data?.data?.leads || [];
        setAssignedLeads(list);
      })
      .catch(() => {
        toast.error('Failed to load assigned leads');
        setAssignedLeads([]);
      })
      .finally(() => setLoadingLeads(false));
  }, [user?.counselorProfile?.id, user?.counselorProfile?._id, leadsProp.length]);

  const fetchLeadById = async () => {
    const id = selectedLeadId?.trim();
    if (!id) {
      toast.error('Please select a lead');
      return;
    }
    setLoadingLead(true);
    try {
      const res = await leadAPI.getById(id);
      const leadData = res.data?.data?.lead || res.data?.data;
      setLead(leadData);
      setForm((f) => ({
        ...f,
        step1: {
          studentName: leadData.studentName || '',
          parentName: leadData.parentName || '',
          studentContactNumber: leadData.parentMobile || '',
          parentContactNumber: leadData.parentMobile || '',
          email: leadData.parentEmail || '',
          city: leadData.parentCity || '',
          courseInterestedIn: leadData.course?.name || leadData.importedCourseName || '',
          currentQualification: leadData.currentClass || '',
          leadSource: leadData.leadSource || '',
          assignedCounselor: leadData.assignedCounselor?.fullName || '',
        },
      }));
      setStep(1);
      if (leadData?.id) {
        try {
          const historyRes = await counselorAPI.voiceCall.getCallHistory(leadData.id);
          setCallHistory(historyRes.data?.data?.callHistory || []);
        } catch {
          setCallHistory([]);
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load lead details.');
    } finally {
      setLoadingLead(false);
    }
  };

  const updateForm = (stepKey, data) => {
    setForm((f) => ({ ...f, [stepKey]: { ...f[stepKey], ...data } }));
  };

  const handleSkip = () => {
    setSkipped((s) => ({ ...s, [step]: true }));
    setStep((s) => Math.min(s + 1, 6));
  };

  const getCallSummaryForSave = () => {
    const structured = buildStructuredCallSummary(form);
    const extra = form.step6?.callSummary?.trim();
    return extra ? `${structured}\n\n——— Additional notes ———\n${extra}` : structured;
  };

  const handleSaveAndExit = async () => {
    if (!lead?.id) return;
    setSubmitting(true);
    try {
      const callSummary = getCallSummaryForSave();
      await counselorAPI.voiceCall.save({
        leadId: lead.id,
        callSummary,
        leadTemperature: form.step5.leadTemperature,
        conversionProbability: form.step5.conversionProbability,
        formData: form,
        followUpRequired: !!form.step6.followUpRequired,
        followUpDateTime: form.step6.followUpRequired ? form.step6.followUpDateTime : null,
        followUpMode: form.step6.followUpMode,
      });
      toast.success('Call update saved');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveCallUpdate = async () => {
    if (form.step6.followUpRequired && !form.step6.followUpDateTime) {
      toast.error('Follow-up date & time is required when follow-up is enabled');
      return;
    }
    setSubmitting(true);
    try {
      const callSummary = getCallSummaryForSave();
      await counselorAPI.voiceCall.save({
        leadId: lead.id,
        callSummary,
        leadTemperature: form.step5.leadTemperature,
        conversionProbability: form.step5.conversionProbability,
        formData: form,
        followUpRequired: !!form.step6.followUpRequired,
        followUpDateTime: form.step6.followUpRequired ? form.step6.followUpDateTime : null,
        followUpMode: form.step6.followUpMode,
      });
      setCallHistory((prev) => [
        { callTimestamp: new Date().toISOString(), callSummary, counselor: { fullName: 'You' } },
        ...prev,
      ]);
      setJustSavedSummary(callSummary);
      toast.success('Call notes saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const opts = (cat) => {
    const fromApi = masterOptions[cat];
    if (fromApi && fromApi.length > 0) return fromApi;
    return VOICE_CALL_OPTIONS_FALLBACK[cat] || [];
  };
  const lastCall = callHistory[0];

  const handleCloseAfterSave = () => {
    setJustSavedSummary(null);
    onClose();
  };

  if (step === 0 && !lead) {
    const leadLabel = (l) => {
      const name = l.studentName || l.parentName || 'Unknown';
      const lid = l.leadId || l.id || '';
      return lid ? `${lid} (${name})` : name;
    };
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-soft max-w-lg mx-auto">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Voice Call Lead Update</h2>
        <p className="text-sm text-gray-500 mb-4">Select an assigned lead to update call details.</p>
        <div className="flex gap-2 flex-col sm:flex-row">
          <select
            value={selectedLeadId}
            onChange={(e) => setSelectedLeadId(e.target.value)}
            className="input-field flex-1"
            disabled={loadingLeads}
          >
            <option value="">
              {loadingLeads ? 'Loading your assigned leads...' : assignedLeads.length === 0 ? 'No assigned leads' : 'Select lead'}
            </option>
            {assignedLeads.map((l) => (
              <option key={l.id} value={l.id}>
                {leadLabel(l)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={fetchLeadById}
            disabled={loadingLead || !selectedLeadId || loadingLeads}
            className="btn-primary px-5"
          >
            {loadingLead ? 'Loading...' : 'Next'}
          </button>
        </div>
        {!loadingLeads && assignedLeads.length === 0 && (
          <p className="text-xs text-amber-600 mt-2">You have no leads assigned. Ask admin to assign leads to you.</p>
        )}
        {onClose && (
          <button type="button" onClick={onClose} className="mt-4 text-sm text-gray-500 hover:text-gray-700">
            Cancel
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-soft overflow-hidden max-w-3xl mx-auto">
      {/* Stepper */}
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {STEPS.map((label, i) => (
            <div
              key={i}
              className={`flex items-center gap-1.5 ${i + 1 === step ? 'text-primary-600 font-medium' : i + 1 < step ? 'text-gray-600' : 'text-gray-400'}`}
            >
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${i + 1 === step ? 'bg-primary-500 text-white' : i + 1 < step ? 'bg-green-100 text-green-700' : 'bg-gray-200'}`}>
                {skipped[i + 1] ? '○' : i + 1}
              </span>
              <span className="hidden sm:inline text-sm">{label}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">Step {step} of 6</p>
      </div>

      {/* After save: show Download + Done */}
      {justSavedSummary && (
        <div className="px-6 py-4 bg-green-50 border-b border-green-100">
          <p className="text-sm font-medium text-green-800 mb-2">Call notes saved successfully.</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                const leadLabel = lead?.leadId || lead?.studentName || lead?.id || 'lead';
                const dateStr = format(new Date(), 'yyyy-MM-dd');
                downloadCallNotes(justSavedSummary, `Counselling_Call_Notes_${leadLabel}_${dateStr}.txt`);
                toast.success('Call notes downloaded');
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg"
            >
              <Download className="w-4 h-4" />
              Download call notes
            </button>
            <button
              type="button"
              onClick={handleCloseAfterSave}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-green-800 bg-green-100 hover:bg-green-200 rounded-lg"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Last Call – Download option only (when no just-saved panel) */}
      {lastCall && !justSavedSummary && (
        <div className="px-6 py-3 bg-amber-50 border-b border-amber-100 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-amber-800">
            Last call: {format(new Date(lastCall.callTimestamp), 'PPp')}
          </p>
          <button
            type="button"
            onClick={() => {
              const leadLabel = lead?.leadId || lead?.studentName || lead?.id || 'lead';
              const dateStr = format(new Date(lastCall.callTimestamp), 'yyyy-MM-dd');
              downloadCallNotes(lastCall.callSummary, `Counselling_Call_Notes_${leadLabel}_${dateStr}.txt`);
              toast.success('Call notes downloaded');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-lg"
          >
            <Download className="w-4 h-4" />
            Download call notes
          </button>
        </div>
      )}

      <div className="p-6 min-h-[320px]">
        {/* Step 1: Basic Lead Details */}
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Basic Lead Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {['studentName', 'parentName', 'studentContactNumber', 'parentContactNumber', 'email', 'city', 'courseInterestedIn', 'currentQualification', 'leadSource', 'assignedCounselor'].map((key) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{key.replace(/([A-Z])/g, ' $1').trim()}</label>
                  <input
                    type="text"
                    value={form.step1[key] || ''}
                    onChange={(e) => updateForm('step1', { [key]: e.target.value })}
                    className="input-field w-full"
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-4">
              <button type="button" onClick={() => setStep(2)} className="btn-primary">Next</button>
            </div>
          </div>
        )}

        {/* Step 2: Academic Discussion (dropdown only) */}
        {step === 2 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Academic Discussion</h3>
            <p className="text-sm text-gray-500">Select from dropdowns only. Answers will form the call summary.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DropdownField label="How confident is the student about their academic performance?" value={form.step2.academicConfidence} onChange={(v) => updateForm('step2', { academicConfidence: v })} options={opts('academic_confidence')} />
              <DropdownField label="Academic performance band" value={form.step2.academicPerformanceBand} onChange={(v) => updateForm('step2', { academicPerformanceBand: v })} options={opts('academic_performance_band')} />
              <DropdownField label="Passing year" value={form.step2.passingYear} onChange={(v) => updateForm('step2', { passingYear: v })} options={opts('passing_year')} />
              <DropdownField label="Entrance exam" value={form.step2.entranceExam} onChange={(v) => updateForm('step2', { entranceExam: v })} options={opts('entrance_exam')} />
              <DropdownField label="Entrance score band" value={form.step2.entranceScoreBand} onChange={(v) => updateForm('step2', { entranceScoreBand: v })} options={opts('entrance_score_band')} />
              <DropdownField label="Entrance exam preparation status" value={form.step2.entranceExamPreparation} onChange={(v) => updateForm('step2', { entranceExamPreparation: v })} options={opts('entrance_exam_preparation')} />
              <DropdownField label="Course clarity" value={form.step2.courseClarity} onChange={(v) => updateForm('step2', { courseClarity: v })} options={opts('course_clarity')} />
              <DropdownField label="Preferred college type" value={form.step2.preferredCollegeType} onChange={(v) => updateForm('step2', { preferredCollegeType: v })} options={opts('preferred_college_type')} />
              <DropdownField label="Concern about eligibility" value={form.step2.eligibilityConcern} onChange={(v) => updateForm('step2', { eligibilityConcern: v })} options={opts('eligibility_concern')} />
              <DropdownField label="Gap year?" value={form.step2.gapYear} onChange={(v) => updateForm('step2', { gapYear: v })} options={opts('gap_year')} />
              {form.step2.gapYear === 'Yes' && (
                <DropdownField label="Gap year reason" value={form.step2.gapYearReason} onChange={(v) => updateForm('step2', { gapYearReason: v })} options={opts('gap_year_reason')} />
              )}
              <DropdownField label="Seriousness toward studies" value={form.step2.seriousnessStudies} onChange={(v) => updateForm('step2', { seriousnessStudies: v })} options={opts('seriousness_studies')} />
            </div>
            <div className="flex justify-between pt-4">
              <button type="button" onClick={() => setStep(1)} className="btn-secondary">Back</button>
              <div className="flex gap-2">
                <button type="button" onClick={handleSkip} className="text-gray-600 hover:text-gray-800">Skip</button>
                <button type="button" onClick={() => setStep(3)} className="btn-primary">Next</button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Loan Requirement (dropdown only) */}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Loan Requirement</h3>
            <p className="text-sm text-gray-500">Select from dropdowns only.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DropdownField label="Loan required?" value={form.step3.loanRequired} onChange={(v) => updateForm('step3', { loanRequired: v })} options={opts('loan_required')} />
              <DropdownField label="Family's approximate budget for the course" value={form.step3.familyBudget} onChange={(v) => updateForm('step3', { familyBudget: v })} options={opts('family_budget')} />
              <DropdownField label="Family financial planning" value={form.step3.financialPlanning} onChange={(v) => updateForm('step3', { financialPlanning: v })} options={opts('financial_planning')} />
              <DropdownField label="Loan willingness" value={form.step3.loanWillingness} onChange={(v) => updateForm('step3', { loanWillingness: v })} options={opts('loan_willingness')} />
              <DropdownField label="Scholarship interest" value={form.step3.scholarshipInterest} onChange={(v) => updateForm('step3', { scholarshipInterest: v })} options={opts('scholarship_interest')} />
              <DropdownField label="Fee sensitivity" value={form.step3.feeSensitivity} onChange={(v) => updateForm('step3', { feeSensitivity: v })} options={opts('fee_sensitivity')} />
              <DropdownField label="Financial dependency" value={form.step3.financialDependency} onChange={(v) => updateForm('step3', { financialDependency: v })} options={opts('financial_dependency')} />
            </div>
            <div className="flex justify-between pt-4">
              <button type="button" onClick={() => setStep(2)} className="btn-secondary">Back</button>
              <div className="flex gap-2">
                <button type="button" onClick={handleSkip} className="text-gray-600 hover:text-gray-800">Skip</button>
                <button type="button" onClick={() => setStep(4)} className="btn-primary">Next</button>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Decision Analysis (dropdown only) */}
        {step === 4 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Decision Analysis</h3>
            <p className="text-sm text-gray-500">Select from dropdowns only.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DropdownField label="Expected admission timeline" value={form.step4.admissionTimeline} onChange={(v) => updateForm('step4', { admissionTimeline: v })} options={opts('admission_timeline')} />
              <DropdownField label="Admission urgency" value={form.step4.admissionUrgency} onChange={(v) => updateForm('step4', { admissionUrgency: v })} options={opts('admission_urgency')} />
              <DropdownField label="Contacted other colleges?" value={form.step4.contactedOtherColleges} onChange={(v) => updateForm('step4', { contactedOtherColleges: v })} options={opts('contacted_other_colleges')} />
              <DropdownField label="Talking to other consultants?" value={form.step4.talkingToOtherConsultants} onChange={(v) => updateForm('step4', { talkingToOtherConsultants: v })} options={opts('talking_to_other_consultants')} />
              <DropdownField label="Major concern" value={form.step4.majorConcern} onChange={(v) => updateForm('step4', { majorConcern: v })} options={opts('major_concern')} />
              <DropdownField label="Trust level in counselling" value={form.step4.trustCounselling} onChange={(v) => updateForm('step4', { trustCounselling: v })} options={opts('trust_counselling')} />
              <DropdownField label="Parent concerns" value={form.step4.parentConcerns} onChange={(v) => updateForm('step4', { parentConcerns: v })} options={opts('parent_concerns')} />
              <DropdownField label="External influences on decision" value={form.step4.externalInfluences} onChange={(v) => updateForm('step4', { externalInfluences: v })} options={opts('external_influences')} />
              <DropdownField label="Decision drivers" value={form.step4.decisionDrivers} onChange={(v) => updateForm('step4', { decisionDrivers: v })} options={opts('decision_drivers')} />
            </div>
            <div className="flex justify-between pt-4">
              <button type="button" onClick={() => setStep(3)} className="btn-secondary">Back</button>
              <div className="flex gap-2">
                <button type="button" onClick={handleSkip} className="text-gray-600 hover:text-gray-800">Skip</button>
                <button type="button" onClick={() => setStep(5)} className="btn-primary">Next</button>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Lead Qualification (dropdown only + conversion slider) */}
        {step === 5 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Lead Qualification</h3>
            <p className="text-sm text-gray-500">Select from dropdowns. Conversion probability uses the slider.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DropdownField label="Lead temperature" value={form.step5.leadTemperature} onChange={(v) => updateForm('step5', { leadTemperature: v })} options={opts('lead_temperature')} />
              <DropdownField label="Seriousness of admission" value={form.step5.admissionSeriousness} onChange={(v) => updateForm('step5', { admissionSeriousness: v })} options={opts('admission_seriousness')} />
              <DropdownField label="How motivated is the student?" value={form.step5.studentMotivation} onChange={(v) => updateForm('step5', { studentMotivation: v })} options={opts('student_motivation')} />
              <DropdownField label="Parent involvement" value={form.step5.parentInvolvement} onChange={(v) => updateForm('step5', { parentInvolvement: v })} options={opts('parent_involvement')} />
              <DropdownField label="Likelihood of joining through platform" value={form.step5.likelihoodJoining} onChange={(v) => updateForm('step5', { likelihoodJoining: v })} options={opts('likelihood_joining')} />
              <DropdownField label="Competition from other consultants?" value={form.step5.competitionConsultants} onChange={(v) => updateForm('step5', { competitionConsultants: v })} options={opts('competition_consultants')} />
              <DropdownField label="Counsellor's assessment" value={form.step5.counsellorAssessment} onChange={(v) => updateForm('step5', { counsellorAssessment: v })} options={opts('counsellor_assessment')} />
              <DropdownField label="Priority level" value={form.step5.priorityLevel} onChange={(v) => updateForm('step5', { priorityLevel: v })} options={opts('priority_level')} />
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Conversion probability (0–100)</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={form.step5.conversionProbability ?? 50}
                  onChange={(e) => updateForm('step5', { conversionProbability: e.target.value })}
                  className="w-full"
                />
                <span className="text-sm font-medium text-gray-700">{form.step5.conversionProbability ?? 50}%</span>
              </div>
            </div>
            <div className="flex justify-between pt-4">
              <button type="button" onClick={() => setStep(4)} className="btn-secondary">Back</button>
              <button type="button" onClick={() => setStep(6)} className="btn-primary">Next</button>
            </div>
          </div>
        )}

        {/* Step 6: Call Summary & Follow-up */}
        {step === 6 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Call Summary & Follow-up</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Additional notes (optional)</label>
              <p className="text-xs text-gray-500 mb-1">A structured call summary is generated automatically from your dropdown answers. Add any extra notes below.</p>
              <textarea
                value={form.step6.callSummary}
                onChange={(e) => updateForm('step6', { callSummary: e.target.value })}
                rows={4}
                className="input-field w-full"
                placeholder="Optional: extra notes or comments"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.step6.followUpRequired}
                  onChange={(e) => updateForm('step6', { followUpRequired: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm font-medium text-gray-700">Follow-up Required</span>
              </label>
            </div>
            {form.step6.followUpRequired && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Follow-up Date & Time (Mandatory)</label>
                  <input
                    type="datetime-local"
                    value={form.step6.followUpDateTime}
                    onChange={(e) => updateForm('step6', { followUpDateTime: e.target.value })}
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Follow-up Mode</label>
                  <select value={form.step6.followUpMode || ''} onChange={(e) => updateForm('step6', { followUpMode: e.target.value })} className="input-field w-full">
                    <option value="">Select</option>
                    {opts('follow_up_mode').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </>
            )}
            <div className="flex justify-between pt-4">
              <button type="button" onClick={() => setStep(5)} className="btn-secondary">Back</button>
              <div className="flex gap-2">
                <button type="button" onClick={handleSaveAndExit} disabled={submitting} className="btn-secondary">Save & Exit</button>
                <button type="button" onClick={handleSaveCallUpdate} disabled={submitting} className="btn-primary">
                  {submitting ? 'Saving...' : 'Save Call Update'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Call History – Download per entry */}
      {callHistory.length > 0 && (
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Call History</h4>
          <ul className="space-y-2 max-h-40 overflow-y-auto">
            {callHistory.slice(0, 5).map((log, i) => (
              <li key={i} className="flex items-center justify-between gap-2 text-xs border-l-2 border-primary-200 pl-2 py-1.5">
                <span className="font-medium text-gray-800">{format(new Date(log.callTimestamp), 'PPp')}</span>
                <button
                  type="button"
                  onClick={() => {
                    const leadLabel = lead?.leadId || lead?.studentName || lead?.id || 'lead';
                    const dateStr = format(new Date(log.callTimestamp), 'yyyy-MM-dd');
                    const suffix = i > 0 ? `_${i}` : '';
                    downloadCallNotes(log.callSummary, `Counselling_Call_Notes_${leadLabel}_${dateStr}${suffix}.txt`);
                    toast.success('Call notes downloaded');
                  }}
                  className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 font-medium"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {loadingOptions && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-2xl">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-500 border-t-transparent" />
        </div>
      )}
    </div>
  );
}
