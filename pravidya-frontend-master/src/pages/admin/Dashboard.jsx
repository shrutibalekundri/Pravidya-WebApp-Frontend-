import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Bot, UserCircle, CheckCircle, Users, Calendar, AlertCircle, X } from 'lucide-react';
import { adminAPI, presenceAPI, leadAPI, managementAPI } from '../../services/api';
import toast from 'react-hot-toast';

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [inactivityAlerts, setInactivityAlerts] = useState([]);
  const [adminAlerts, setAdminAlerts] = useState([]);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);
  const [availableCounselors, setAvailableCounselors] = useState([]);
  const [selectedCounselorId, setSelectedCounselorId] = useState('');
  const [reassigning, setReassigning] = useState(false);
  const [releasedAppointments, setReleasedAppointments] = useState([]);
  const [loadingReleased, setLoadingReleased] = useState(false);
  const [showReleasedModal, setShowReleasedModal] = useState(false);
  const [counselorStatusList, setCounselorStatusList] = useState([]);
  const [loadingCounselorStatus, setLoadingCounselorStatus] = useState(true);

  const fetchCounselorStatus = async () => {
    try {
      const response = await presenceAPI.getAllStatus();
      setCounselorStatusList(response.data?.data || []);
    } catch (error) {
      console.error('Failed to load counselor status:', error);
    } finally {
      setLoadingCounselorStatus(false);
    }
  };

  useEffect(() => {
    // Load all data in parallel for faster initial load
    Promise.all([
      fetchDashboardData(),
      fetchInactivityAlerts(),
      fetchAdminAlerts(),
      fetchReleasedAppointments(),
      fetchCounselorStatus()
    ]).catch(error => {
      console.error('Error loading dashboard data:', error);
    });
    
    // Refresh alerts every 2 minutes
    const interval = setInterval(() => {
      fetchInactivityAlerts();
      fetchAdminAlerts();
      fetchReleasedAppointments();
      fetchCounselorStatus();
    }, 120000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchReleasedAppointments = async () => {
    setLoadingReleased(true);
    try {
      const response = await managementAPI.getReleasedAppointments();
      setReleasedAppointments(response.data.data);
    } catch (error) {
      console.error('Failed to load released appointments:', error);
    } finally {
      setLoadingReleased(false);
    }
    return Promise.resolve();
  };

  const handleReassignAppointment = async (sessionId, newCounselorId) => {
    try {
      await managementAPI.reassignAppointment({
        sessionId,
        newCounselorId
      });
      toast.success('Appointment reassigned successfully');
      fetchReleasedAppointments();
      fetchDashboardData();
    } catch (error) {
      toast.error('Failed to reassign appointment');
    }
  };

  const fetchDashboardData = async () => {
    try {
      const response = await adminAPI.getDashboard();
      setStats(response.data.data);
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
    return Promise.resolve();
  };

  const fetchInactivityAlerts = async () => {
    try {
      const response = await presenceAPI.getInactivityAlerts();
      setInactivityAlerts(response.data.data.alerts || []);
    } catch (error) {
      console.error('Failed to load inactivity alerts:', error);
    } finally {
      setLoadingAlerts(false);
    }
    return Promise.resolve();
  };

  const fetchAdminAlerts = async () => {
    try {
      const response = await adminAPI.getAlerts({ limit: 50 });
      setAdminAlerts(response.data.data.alerts || []);
    } catch (error) {
      console.error('Failed to load admin alerts:', error);
    }
    return Promise.resolve();
  };

  const resolveAdminAlert = async (id) => {
    try {
      await adminAPI.resolveAlert(id);
      setAdminAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch (error) {
      toast.error('Failed to resolve alert');
    }
  };

  const handleReassignClick = async (alert, lead = null) => {
    setSelectedAlert(alert);
    setSelectedLead(lead);
    setShowReassignModal(true);
    setSelectedCounselorId('');
    try {
      const response = await leadAPI.getAvailableCounselors({
        excludeCounselorId: alert.counselorId
      });
      setAvailableCounselors(response.data.data.counselors || []);
    } catch (error) {
      toast.error('Failed to load available counselors');
    }
  };

  const handleReassignSubmit = async () => {
    if (!selectedCounselorId || !selectedAlert) return;

    setReassigning(true);
    try {
      // If it's a session reassignment
      if (selectedAlert.sessionId) {
        await managementAPI.reassignAppointment({
          sessionId: selectedAlert.sessionId,
          newCounselorId: selectedCounselorId
        });
        toast.success('Appointment reassigned successfully');
      } else {
        if (!selectedLead?.id) {
          toast.error('Select a lead to reassign');
          return;
        }
        await leadAPI.assign(
          selectedLead.id,
          selectedCounselorId,
          `Reassigned due to counselor inactivity (${selectedAlert.inactiveMinutes || 'N/A'} min)`
        );
        toast.success('Lead reassigned successfully');
      }
      setShowReassignModal(false);
      setSelectedAlert(null);
      setSelectedLead(null);
      fetchInactivityAlerts();
      fetchReleasedAppointments();
      fetchDashboardData();
    } catch (error) {
      toast.error('Failed to reassign');
    } finally {
      setReassigning(false);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Admin Dashboard</h1>
        <p className="text-sm sm:text-base text-slate-600 mt-1">Overview of admissions platform</p>
      </div>

      {/* Stats Grid - Show immediately even if loading */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-5">
        <div className="card border-t-4 border-t-primary-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Total Leads</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">
                {loading ? (
                  <span className="inline-block w-12 h-8 bg-slate-200 animate-pulse rounded"></span>
                ) : (
                  stats?.leads?.total || 0
                )}
              </p>
            </div>
            <div className="w-11 h-11 bg-primary-50 rounded-lg flex items-center justify-center text-primary-600">
              <ClipboardList className="w-5 h-5" strokeWidth={2} />
            </div>
          </div>
        </div>

        <div className="card border-t-4 border-t-emerald-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Auto Assigned</p>
              <p className="text-3xl font-bold text-emerald-600 mt-1">
                {loading ? (
                  <span className="inline-block w-12 h-8 bg-slate-200 animate-pulse rounded"></span>
                ) : (
                  stats?.leads?.assignment?.auto || 0
                )}
              </p>
            </div>
            <div className="w-11 h-11 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600">
              <Bot className="w-5 h-5" strokeWidth={2} />
            </div>
          </div>
        </div>

        <div className="card border-t-4 border-t-amber-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Manual Lead Assigned</p>
              <p className="text-3xl font-bold text-amber-600 mt-1">
                {loading ? (
                  <span className="inline-block w-12 h-8 bg-slate-200 animate-pulse rounded"></span>
                ) : (
                  stats?.leads?.assignment?.manual || 0
                )}
              </p>
            </div>
            <div className="w-11 h-11 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600">
              <UserCircle className="w-5 h-5" strokeWidth={2} />
            </div>
          </div>
        </div>

        <div className="card border-t-4 border-t-violet-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Admissions Confirmed</p>
              <p className="text-3xl font-bold text-violet-600 mt-1">
                {loading ? (
                  <span className="inline-block w-12 h-8 bg-slate-200 animate-pulse rounded"></span>
                ) : (
                  stats?.leads?.enrolled || 0
                )}
              </p>
            </div>
            <div className="w-11 h-11 bg-violet-50 rounded-xl flex items-center justify-center text-violet-600">
              <CheckCircle className="w-5 h-5" strokeWidth={2} />
            </div>
          </div>
        </div>

        <div className="card border-t-4 border-t-indigo-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Active Counselors</p>
              <p className="text-3xl font-bold text-indigo-700 mt-1">
                {loading ? (
                  <span className="inline-block w-12 h-8 bg-slate-200 animate-pulse rounded"></span>
                ) : (
                  stats?.counselors?.active || 0
                )}
              </p>
            </div>
            <div className="w-11 h-11 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
              <Users className="w-5 h-5" strokeWidth={2} />
            </div>
          </div>
        </div>
      </div>

      {/* Classification Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Lead Classification</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-slate-600">New</span>
              <span className="font-semibold text-slate-900">
                {stats?.leads?.classification?.new ?? 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Counseling In Progress</span>
              <span className="font-semibold text-slate-900">
                {stats?.leads?.classification?.counselingInProgress ?? 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Priority</span>
              <span className="font-semibold text-slate-900">
                {stats?.leads?.classification?.priority ?? 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Admission Confirmed</span>
              <span className="font-semibold text-slate-900">
                {stats?.leads?.classification?.admissionConfirmed ?? 0}
              </span>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Assignment Stats</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Auto Assigned</span>
              <span className="font-semibold text-emerald-600">
                {stats?.leads?.assignment?.auto || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Manual Assigned</span>
              <span className="font-semibold text-primary-600">
                {stats?.leads?.assignment?.manual || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Unassigned</span>
              <span className="font-semibold text-red-600">
                {stats?.leads?.assignment?.unassigned || 0}
              </span>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Recent Activity</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Recent Leads (24h)</span>
              <span className="font-semibold text-slate-900">
                {stats?.recent?.leads || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Recent Activity</span>
              <span className="font-semibold text-slate-900">
                {stats?.recent?.activity || 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Released Appointments */}
      {releasedAppointments.total > 0 && (
        <div className="card border-l-4 border-l-orange-500">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-orange-600" strokeWidth={2} />
                Released Appointments
                <span className="ml-2 px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full font-medium">
                  {releasedAppointments.total}
                </span>
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Appointments requiring reassignment
              </p>
            </div>
            <button
              onClick={() => setShowReleasedModal(true)}
              className="btn-primary text-sm"
            >
              View All
            </button>
          </div>
          <div className="space-y-2">
            {releasedAppointments.releasedSessions?.slice(0, 3).map((session, idx) => (
              <div key={idx} className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900">{session.lead?.studentName}</div>
                    <div className="text-sm text-slate-600 mt-1">
                      <div>Parent: {session.lead?.parentName}</div>
                      <div>Scheduled: {new Date(session.scheduledDate).toLocaleString()}</div>
                      <div className="text-xs text-red-600 mt-1">Released from: {session.counselor?.user?.username}</div>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        const response = await leadAPI.getAvailableCounselors({
                          excludeCounselorId: session.counselorId
                        });
                        setAvailableCounselors(response.data.data.counselors || []);
                        setSelectedAlert({
                          sessionId: session.id,
                          leads: [{ id: session.lead?.id, studentName: session.lead?.studentName, parentName: session.lead?.parentName }],
                          counselorId: session.counselorId
                        });
                        setShowReassignModal(true);
                      } catch (error) {
                        toast.error('Failed to load counselors');
                      }
                    }}
                    className="btn-primary text-xs ml-4"
                  >
                    Reassign
                  </button>
                </div>
              </div>
            ))}
            {releasedAppointments.total > 3 && (
              <button
                onClick={() => setShowReleasedModal(true)}
                className="w-full text-sm text-primary-600 hover:text-primary-700 py-2"
              >
                View {releasedAppointments.total - 3} more...
              </button>
            )}
          </div>
        </div>
      )}

      {/* Counselor Status panel */}
      <div className="card border-l-4 border-indigo-500">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" strokeWidth={2} />
            Counselor Status
          </h3>
          <button
            onClick={() => { setLoadingCounselorStatus(true); fetchCounselorStatus(); }}
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            Refresh
          </button>
        </div>
        <p className="text-sm text-slate-600 mb-4">Current clock-in and break status for all counselors.</p>
        {loadingCounselorStatus ? (
          <div className="py-8 text-center text-slate-500">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-600 font-medium">
                  <th className="pb-2 pr-4">Counselor Name</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Since</th>
                  <th className="pb-2">Break Reason</th>
                </tr>
              </thead>
              <tbody>
                {counselorStatusList.length === 0 ? (
                  <tr><td colSpan={4} className="py-6 text-center text-slate-500">No counselors found</td></tr>
                ) : (
                  counselorStatusList.map((row) => {
                    const since = row.since ? new Date(row.since).toLocaleString() : '—';
                    const statusLabel = row.status?.replace(/_/g, ' ') || 'Offline';
                    const statusClass =
                      row.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                      row.status === 'ON_BREAK' ? 'bg-amber-100 text-amber-800' :
                      row.status === 'IN_MEETING' ? 'bg-blue-100 text-blue-800' :
                      row.status === 'AWAY' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-slate-100 text-slate-600';
                    return (
                      <tr key={row.counselorId} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="py-3 pr-4 font-medium text-slate-900">{row.counselorName || '—'}</td>
                        <td className="py-3 pr-4">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusClass}`}>
                            {statusLabel}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-slate-600">{since}</td>
                        <td className="py-3 text-slate-600">{row.breakReason || '—'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inactivity Alerts */}
      {inactivityAlerts.length > 0 && (
        <div className="card border-l-4 border-red-500">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <span className="inline-flex w-5 h-5 items-center justify-center rounded-full bg-red-100 text-red-600">
                  <AlertCircle className="w-3.5 h-3.5" strokeWidth={2} />
                </span>
                Inactivity Alerts
                <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full font-medium">
                  {inactivityAlerts.length}
                </span>
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Counselors inactive for 4 hours
              </p>
            </div>
            <button
              onClick={fetchInactivityAlerts}
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              Refresh
            </button>
          </div>
          <div className="space-y-3">
            {inactivityAlerts.map((alert, index) => (
              <div
                key={index}
                className="p-4 bg-red-50 border border-red-200 rounded-lg"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900">{alert.counselorName}</div>
                    <div className="text-sm text-slate-600 mt-1">
                      <div>
                        Inactive for:{' '}
                        <span className="font-semibold">
                          {(() => {
                            const mins = alert.inactiveMinutes || 0;
                            const hours = Math.floor(mins / 60);
                            const rem = mins % 60;
                            if (hours <= 0) return `${mins} minutes`;
                            if (rem === 0) return `${hours} hours`;
                            return `${hours} hours ${rem} minutes`;
                          })()}
                        </span>
                      </div>
                      <div>Status: <span className="font-semibold">{alert.currentStatus}</span></div>
                      <div>Affected Leads: <span className="font-semibold text-red-600">{alert.affectedLeads}</span></div>
                      {alert.lastActivityAt && (
                        <div className="text-xs text-slate-500 mt-1">
                          Last active: {new Date(alert.lastActivityAt).toLocaleString()}
                        </div>
                      )}
                    </div>
                    {alert.requiresReassignment && alert.leads.length > 0 && (
                      <div className="mt-2">
                        <div className="text-xs font-semibold text-red-700 mb-1">Leads requiring reassignment:</div>
                        <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto pr-1">
                          {alert.leads.map((lead) => (
                            <button
                              key={lead.id}
                              type="button"
                              title="Reassign this lead"
                              onClick={() => handleReassignClick(alert, lead)}
                              className="px-2 py-1 bg-white border border-red-300 rounded text-xs hover:bg-red-100 transition-colors"
                            >
                              {lead.studentName}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {Array.isArray(alert.reassignedLeads) && alert.reassignedLeads.length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs font-semibold text-emerald-700 mb-1">
                          Reassigned automatically:
                        </div>
                        <div className="space-y-1">
                          {alert.reassignedLeads.slice(0, 10).map((r) => (
                            <div key={r.id} className="text-xs text-emerald-800">
                              {r.studentName}{r.leadId ? <span className="text-emerald-700"> ({r.leadId})</span> : null}
                              {' '}→{' '}
                              <span className="font-semibold">{r.toCounselorName || 'New counselor'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Counselors */}
      {stats?.topCounselors && stats.topCounselors.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Top Performing Counselors</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-4 text-slate-600 font-medium">Counselor</th>
                  <th className="text-right py-2 px-4 text-slate-600 font-medium">Enrolled Leads</th>
                </tr>
              </thead>
              <tbody>
                {stats.topCounselors.map((item, index) => (
                  <tr key={index} className="border-b border-slate-100">
                    <td className="py-2 px-4 text-slate-900">{item.counselorName}</td>
                    <td className="py-2 px-4 text-right font-semibold text-slate-900">
                      {item.enrolledCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reassignment Modal */}
      {showReassignModal && selectedAlert && (
        <div className="fixed inset-0 bg-slate-900/30 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-900">
                  {selectedAlert.sessionId ? 'Reassign Session' : 'Reassign Lead'}
                </h2>
                <button
                  onClick={() => {
                    setShowReassignModal(false);
                    setSelectedAlert(null);
                    setSelectedLead(null);
                    setSelectedCounselorId('');
                  }}
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" strokeWidth={2} />
                </button>
              </div>

              <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                {selectedAlert.sessionId ? (
                  <>
                    <div className="font-semibold text-slate-900 mb-2">
                      Session Reassignment
                    </div>
                    <div className="text-sm text-slate-600">
                      {selectedAlert.leads.length} appointment(s) need reassignment
                    </div>
                  </>
                ) : (
                  <>
                    <div className="font-semibold text-slate-900 mb-2">
                      Counselor: {selectedAlert.counselorName}
                    </div>
                    <div className="text-sm text-slate-600">
                      Inactive for {selectedAlert.inactiveMinutes} minutes
                    </div>
                    {selectedLead && (
                      <div className="text-sm text-slate-700 mt-2">
                        Lead: <span className="font-semibold">{selectedLead.studentName}</span>
                        {selectedLead.parentName ? <span className="text-slate-500"> — {selectedLead.parentName}</span> : null}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Select New Counselor <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedCounselorId}
                  onChange={(e) => setSelectedCounselorId(e.target.value)}
                  className="input-field w-full"
                  required
                >
                  <option value="">Select Counselor</option>
                  {availableCounselors.map((counselor) => (
                    <option key={counselor.id} value={counselor.id}>
                      {counselor.fullName} - {counselor.presenceStatus} (Load: {counselor.loadPercentage}%)
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  onClick={() => {
                    setShowReassignModal(false);
                    setSelectedAlert(null);
                    setSelectedLead(null);
                    setSelectedCounselorId('');
                  }}
                  className="btn-secondary"
                  disabled={reassigning}
                >
                  Cancel
                </button>
                <button
                  onClick={handleReassignSubmit}
                  className="btn-primary"
                  disabled={reassigning || !selectedCounselorId || (!selectedAlert.sessionId && !selectedLead?.id)}
                >
                  {reassigning 
                    ? 'Reassigning...' 
                    : selectedAlert.sessionId
                      ? 'Reassign Session'
                      : 'Reassign Lead'
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Released Appointments Modal */}
      {showReleasedModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-900">Released Appointments</h2>
                <button
                  onClick={() => {
                    setShowReleasedModal(false);
                    fetchReleasedAppointments();
                  }}
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" strokeWidth={2} />
                </button>
              </div>

              {/* Released Sessions */}
              {releasedAppointments.releasedSessions?.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold text-slate-900 mb-3">Cancelled Sessions</h3>
                  <div className="space-y-3">
                    {releasedAppointments.releasedSessions.map((session, idx) => (
                      <div key={idx} className="p-4 border border-orange-200 rounded-lg bg-orange-50">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="font-semibold text-slate-900">{session.lead?.studentName}</div>
                            <div className="text-sm text-slate-600 mt-1 space-y-1">
                              <div>Lead ID: {session.lead?.leadId}</div>
                              <div>Parent: {session.lead?.parentName} ({session.lead?.parentMobile})</div>
                              <div>Course: {session.lead?.course?.name || 'N/A'}</div>
                              <div>Scheduled: {new Date(session.scheduledDate).toLocaleString()}</div>
                              <div className="text-xs text-red-600 mt-1">
                                Previous Counselor: {session.counselor?.user?.username || 'N/A'}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={async () => {
                              try {
                                const response = await leadAPI.getAvailableCounselors({
                                  excludeCounselorId: session.counselorId
                                });
                                setAvailableCounselors(response.data.data.counselors || []);
                                setSelectedAlert({
                                  sessionId: session.id,
                                  leads: [{ id: session.lead?.id, studentName: session.lead?.studentName, parentName: session.lead?.parentName }],
                                  counselorId: session.counselorId
                                });
                                setShowReassignModal(true);
                              } catch (error) {
                                toast.error('Failed to load counselors');
                              }
                            }}
                            className="btn-primary text-sm ml-4"
                          >
                            Reassign
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Unassigned Leads */}
              {releasedAppointments.unassignedLeads?.length > 0 && (
                <div>
                  <h3 className="font-semibold text-slate-900 mb-3">Unassigned Leads</h3>
                  <div className="space-y-3">
                    {releasedAppointments.unassignedLeads.map((lead, idx) => (
                      <div key={idx} className="p-4 border border-slate-200 rounded-lg">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="font-semibold text-slate-900">{lead.studentName}</div>
                            <div className="text-sm text-slate-600 mt-1 space-y-1">
                              <div>Lead ID: {lead.leadId}</div>
                              <div>Parent: {lead.parentName} ({lead.parentMobile})</div>
                              <div>Course: {lead.course?.name || 'N/A'}</div>
                              <div>Submitted: {new Date(lead.submittedAt).toLocaleString()}</div>
                            </div>
                          </div>
                          <button
                            onClick={async () => {
                              try {
                                const res = await leadAPI.autoAssignRoundRobin(lead.id);
                                const counselorName = res.data?.data?.lead?.assignedCounselor?.fullName;
                                toast.success(
                                  counselorName
                                    ? `Assigned to ${counselorName} (round robin)`
                                    : 'Auto assignment attempted (round robin)'
                                );
                                // Optimistically update dashboard state so the chip/count drops immediately.
                                setReleasedAppointments((prev) => {
                                  const remaining = (prev.unassignedLeads || []).filter((l) => l.id !== lead.id);
                                  const total = (prev.releasedSessions?.length || 0) + remaining.length;
                                  return { ...prev, unassignedLeads: remaining, total };
                                });
                                fetchDashboardData();
                              } catch (error) {
                                toast.error(error.response?.data?.message || 'Auto assignment failed');
                              }
                            }}
                            className="btn-primary text-sm ml-4"
                          >
                            Assign
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {releasedAppointments.total === 0 && (
                <div className="text-center py-12 text-slate-500">
                  No released appointments found
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
