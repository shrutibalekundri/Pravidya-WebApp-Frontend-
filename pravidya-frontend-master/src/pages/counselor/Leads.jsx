import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { counselorAPI } from '../../services/api';
import { getCached, setCached, getCachedLeads, setCachedLeads } from '../../utils/counselorCache';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

function getLeadsFromCache(counselorId) {
  const fromDashboard = getCachedLeads(counselorId);
  if (fromDashboard?.length) return fromDashboard;
  const fromTab = getCached(`leads_${counselorId}`);
  return Array.isArray(fromTab) ? fromTab : null;
}

// Unified status + classification label mapping so the platform
// shows the same human-friendly statuses everywhere.
const LEAD_STATUS_LABELS = {
  NEW: 'New',
  ON_HOLD: 'Meeting Scheduled',
  CONTACTED: 'Contacted & Interested',
  REJECTED: 'Contacted & Not Interested',
  FOLLOW_UP: 'Contacted – Follow-up Needed',
  FOLLOW_UP_SCHEDULED: 'Contacted – Follow-up Scheduled',
  CALL_NOT_CONNECTED: 'Missed Scheduled Meeting',
  ADMISSION_CONFIRMED: 'Admission Confirmed',
};

const CounselorLeads = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const counselorId = user?.counselorProfile?.id || user?.counselorProfile?._id;
  const [leads, setLeads] = useState(() => (counselorId ? getLeadsFromCache(counselorId) || [] : []));
  const [loading, setLoading] = useState(() => !(counselorId && getLeadsFromCache(counselorId)?.length));

  const fetchLeads = useCallback(async (showCachedFirst = true) => {
    const id = user?.counselorProfile?.id || user?.counselorProfile?._id;
    if (!id) {
      toast.error('Counselor profile not found');
      setLoading(false);
      return;
    }
    const cached = showCachedFirst ? getLeadsFromCache(id) : null;
    if (cached?.length) {
      setLeads(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    try {
      const response = await counselorAPI.getLeads(id);
      const list = response.data?.data?.leads ?? [];
      setLeads(list);
      setCached(`leads_${id}`, list);
      setCachedLeads(id, list);
    } catch (error) {
      if (!cached?.length) {
        console.error('Failed to load leads:', error);
        toast.error('Failed to load leads');
      }
    } finally {
      setLoading(false);
    }
  }, [user?.counselorProfile?.id, user?.counselorProfile?._id]);

  useEffect(() => {
    if (counselorId) {
      const cached = getLeadsFromCache(counselorId);
      if (cached?.length) {
        setLeads(cached);
        setLoading(false);
      }
      fetchLeads();
    }
  }, [counselorId, fetchLeads]);

  const getStatusBadge = (status) => {
    const colors = {
      NEW: 'bg-blue-100 text-blue-800',
      ON_HOLD: 'bg-indigo-100 text-indigo-800',
      CONTACTED: 'bg-yellow-100 text-yellow-800',
      FOLLOW_UP: 'bg-orange-100 text-orange-800',
      FOLLOW_UP_SCHEDULED: 'bg-orange-100 text-orange-800',
      CALL_NOT_CONNECTED: 'bg-rose-100 text-rose-800',
      REJECTED: 'bg-red-100 text-red-800',
      ADMISSION_CONFIRMED: 'bg-emerald-100 text-emerald-800',
      ENROLLED: 'bg-emerald-100 text-emerald-800',
      ON_HOLD: 'bg-slate-100 text-slate-800',
    };
    return colors[status] || 'bg-slate-100 text-slate-800';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">My Assigned Leads</h1>
          <p className="text-slate-600 mt-1">Manage leads assigned to you</p>
        </div>
        <button
          type="button"
          className="btn-primary text-sm w-full sm:w-auto shrink-0"
          onClick={() => navigate('/counselor/leads/create')}
        >
          Add New Lead
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : leads.length === 0 ? (
          <div className="text-center py-12 text-slate-500">No leads assigned yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 text-slate-700 font-semibold">Lead ID</th>
                  <th className="text-left py-3 px-4 text-slate-700 font-semibold">Student</th>
                  <th className="text-left py-3 px-4 text-slate-700 font-semibold">Parent Contact</th>
                  <th className="text-left py-3 px-4 text-slate-700 font-semibold">Course</th>
                  <th className="text-left py-3 px-4 text-slate-700 font-semibold">Status</th>
                  <th className="text-left py-3 px-4 text-slate-700 font-semibold">Date</th>
                  <th className="text-left py-3 px-4 text-slate-700 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => {
                  // If admission is confirmed, show that unified status,
                  // otherwise fall back to the lead's status.
                  const effectiveStatus =
                    lead.classification === 'ADMISSION_CONFIRMED'
                      ? 'ADMISSION_CONFIRMED'
                      : lead.status || 'NEW';
                  const statusLabel = LEAD_STATUS_LABELS[effectiveStatus] || effectiveStatus;

                  return (
                    <tr key={lead.id || lead._id} className="border-b hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <span className="font-mono text-sm text-primary-600">{lead.leadId}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium">{lead.studentName}</div>
                        <div className="text-sm text-slate-500">{lead.currentClass}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium">{lead.parentName}</div>
                          <div className="text-sm text-slate-500">{lead.parentMobile}</div>
                          <div className="text-xs text-slate-400">{lead.parentEmail}</div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {lead.course?.name || 'N/A'}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(
                            effectiveStatus,
                          )}`}
                        >
                          {statusLabel}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-500">
                        {format(new Date(lead.submittedAt), 'MMM dd, yyyy')}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => navigate(`/counselor/leads/${lead.id || lead._id}`)}
                          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CounselorLeads;
