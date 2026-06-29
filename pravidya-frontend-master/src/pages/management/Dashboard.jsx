import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Circle, RefreshCw, AlertTriangle, CircleDot } from 'lucide-react';
import { managementAPI, presenceAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { formatDuration, formatTimeOnly, formatDateTime } from '../../utils/format';

const ManagementDashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchDashboardData();
  }, [selectedDate]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const response = await managementAPI.getDashboard();
      setDashboardData(response.data.data);
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleReassign = async (sessionId, newCounselorId) => {
    try {
      await managementAPI.reassignAppointment({
        sessionId,
        newCounselorId
      });
      toast.success('Appointment reassigned successfully');
      fetchDashboardData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to reassign appointment');
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Management Dashboard</h1>
          <p className="text-slate-600 mt-1">Overview & Analytics</p>
        </div>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="input-field"
        />
      </div>

      {/* Attendance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Present Today</p>
              <p className="text-3xl font-bold text-green-600 mt-1">
                {dashboardData?.attendance?.present || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-green-600">
              <CheckCircle className="w-7 h-7" aria-hidden />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Absent Today</p>
              <p className="text-3xl font-bold text-red-600 mt-1">
                {dashboardData?.attendance?.absent || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center text-red-600">
              <XCircle className="w-7 h-7" aria-hidden />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Active Now</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">
                {dashboardData?.attendance?.active || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
              <CircleDot className="w-7 h-7" aria-hidden />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Reassignments</p>
              <p className="text-3xl font-bold text-yellow-600 mt-1">
                {dashboardData?.reassignments?.count || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center text-yellow-600">
              <RefreshCw className="w-7 h-7" aria-hidden />
            </div>
          </div>
        </div>
      </div>

      {/* Presence Status Breakdown */}
      <div className="card">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Presence Status</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-2xl font-bold text-green-600">{dashboardData?.presence?.active || 0}</p>
            <p className="text-sm text-slate-600 mt-1">Active</p>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <p className="text-2xl font-bold text-yellow-600">{dashboardData?.presence?.away || 0}</p>
            <p className="text-sm text-slate-600 mt-1">Away</p>
          </div>
          <div className="text-center p-4 bg-slate-50 rounded-lg">
            <p className="text-2xl font-bold text-slate-600">{dashboardData?.presence?.offline || 0}</p>
            <p className="text-sm text-slate-600 mt-1">Offline</p>
          </div>
        </div>
      </div>

      {/* Inactivity Alerts */}
      <div className="card">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Inactivity Alerts</h2>
        
        {dashboardData?.alerts?.awayCounselors?.length > 0 && (
          <div className="mb-6">
            <h3 className="font-medium text-yellow-800 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" aria-hidden />
              Away Counselors ({dashboardData.alerts.awayCounselors.length})
            </h3>
            <div className="space-y-2">
              {dashboardData.alerts.awayCounselors.map((counselor) => (
                <div key={counselor.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                  <div>
                    <p className="font-medium">{counselor.name}</p>
                    <p className="text-sm text-slate-600">Inactive for {formatDuration(counselor.inactiveMinutes)}</p>
                  </div>
                  <span className="text-sm text-yellow-700">
                    Last active: {formatTimeOnly(counselor.lastActivity)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {dashboardData?.alerts?.offlineCounselors?.length > 0 && (
          <div>
            <h3 className="font-medium text-red-800 mb-2 flex items-center gap-2">
              <Circle className="w-5 h-5 flex-shrink-0" aria-hidden />
              Offline Counselors ({dashboardData.alerts.offlineCounselors.length})
            </h3>
            <div className="space-y-2">
              {dashboardData.alerts.offlineCounselors.map((counselor) => (
                <div key={counselor.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <div>
                    <p className="font-medium">{counselor.name}</p>
                    <p className="text-sm text-slate-600">Went offline</p>
                  </div>
                  <span className="text-sm text-red-700">
                    Last seen: {formatTimeOnly(counselor.lastActivity)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {(!dashboardData?.alerts?.awayCounselors?.length && !dashboardData?.alerts?.offlineCounselors?.length) && (
          <p className="text-slate-500 text-center py-4">No inactivity alerts</p>
        )}
      </div>

      {/* Appointment Reassignments */}
      {dashboardData?.reassignments?.count > 0 && (
        <div className="card">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">
            Appointments Requiring Reassignment ({dashboardData.reassignments.count})
          </h2>
          <div className="space-y-4">
            {dashboardData.reassignments.sessions.map((session) => (
              <div key={session.id} className="border p-4 rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{session.lead?.studentName}</p>
                    <p className="text-sm text-slate-600">Parent: {session.lead?.parentName}</p>
                    <p className="text-sm text-slate-600">Mobile: {session.lead?.parentMobile}</p>
                    <p className="text-sm text-slate-600 mt-2">
                      Scheduled: {formatDateTime(session.scheduledDate)}
                    </p>
                    <p className="text-sm text-red-600 mt-1">
                      Previous Counselor: {session.counselor?.user?.username}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      // In a real app, you'd show a counselor selection modal
                      toast.info('Counselor selection feature coming soon');
                    }}
                    className="btn-primary text-sm"
                  >
                    Reassign
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Training Statistics */}
      <div className="card">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Training Progress</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-slate-50 rounded-lg">
            <p className="text-2xl font-bold text-slate-600">{dashboardData?.training?.notStarted || 0}</p>
            <p className="text-sm text-slate-600 mt-1">Not Started</p>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-2xl font-bold text-blue-600">{dashboardData?.training?.inProgress || 0}</p>
            <p className="text-sm text-slate-600 mt-1">In Progress</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-2xl font-bold text-green-600">{dashboardData?.training?.completed || 0}</p>
            <p className="text-sm text-slate-600 mt-1">Completed</p>
          </div>
        </div>
      </div>

      {/* Question-Response Statistics */}
      <div className="card">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Question-Response System</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-slate-600">Total Questions</p>
            <p className="text-2xl font-bold text-slate-900">{dashboardData?.questions?.total || 0}</p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Total Responses</p>
            <p className="text-2xl font-bold text-slate-900">{dashboardData?.questions?.responses || 0}</p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Total Score</p>
            <p className="text-2xl font-bold text-blue-600">{dashboardData?.questions?.totalScore || 0}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManagementDashboard;
