import { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Clock, LogOut, Pause, Check } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { counselorAPI, sessionAPI, presenceAPI } from '../../services/api';
import { usePresenceTracking } from '../../hooks/usePresenceTracking';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

// Checklist keys in base priority order; dynamic order & enablement based on counts
const CHECKLIST_KEYS = [
  'call_overdue',
  'update_summaries',
  'attend_scheduled',
  'complete_hot',
  'new_leads',
];

const CHECKLIST_LABELS = {
  call_overdue: 'Call overdue parents',
  update_summaries: 'Update previous call summaries',
  attend_scheduled: "Review today's scheduled sessions",
  complete_hot: 'Check priority leads and follow up',
  new_leads: 'Process new leads assigned',
};

const TAB_KEYS = ['overdue', 'weekend_missed', 'hot', 'today_scheduled', 'new'];
const LEAD_IDS_KEY_MAP = { weekend_missed: 'weekendMissed', today_scheduled: 'todayScheduled' };

const getChecklistStorageKey = () => {
  const d = new Date();
  return `counselor_checklist_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const CACHE_KEY_DAILY = 'counselor_daily_priority';
const CACHE_KEY_STATS = 'counselor_stats';
const CACHE_KEY_LEADS = 'counselor_leads';
const CACHE_KEY_SESSIONS = 'counselor_sessions';
const CACHE_MAX_AGE_MS = 5 * 60 * 1000; // 5 min - serve stale while revalidating

function getCachedDaily(counselorId) {
  try {
    const raw = sessionStorage.getItem(`${CACHE_KEY_DAILY}_${counselorId}`);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_MAX_AGE_MS) return null;
    return data;
  } catch (_) { return null; }
}

function setCachedDaily(counselorId, data) {
  try {
    sessionStorage.setItem(`${CACHE_KEY_DAILY}_${counselorId}`, JSON.stringify({ data, ts: Date.now() }));
  } catch (_) {}
}

function getCachedStats(counselorId) {
  try {
    const raw = sessionStorage.getItem(`${CACHE_KEY_STATS}_${counselorId}`);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_MAX_AGE_MS) return null;
    return data;
  } catch (_) { return null; }
}

function setCachedStats(counselorId, data) {
  try {
    sessionStorage.setItem(`${CACHE_KEY_STATS}_${counselorId}`, JSON.stringify({ data, ts: Date.now() }));
  } catch (_) {}
}

function getCachedLeads(counselorId) {
  try {
    const raw = sessionStorage.getItem(`${CACHE_KEY_LEADS}_${counselorId}`);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_MAX_AGE_MS) return null;
    return Array.isArray(data) ? data : null;
  } catch (_) { return null; }
}

function setCachedLeads(counselorId, data) {
  try {
    sessionStorage.setItem(`${CACHE_KEY_LEADS}_${counselorId}`, JSON.stringify({ data: data || [], ts: Date.now() }));
  } catch (_) {}
}

function getCachedSessions(counselorId) {
  try {
    const raw = sessionStorage.getItem(`${CACHE_KEY_SESSIONS}_${counselorId}`);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_MAX_AGE_MS) return null;
    return Array.isArray(data) ? data : null;
  } catch (_) { return null; }
}

function setCachedSessions(counselorId, data) {
  try {
    sessionStorage.setItem(`${CACHE_KEY_SESSIONS}_${counselorId}`, JSON.stringify({ data: data || [], ts: Date.now() }));
  } catch (_) {}
}

/**
 * BacklogEngine: categorizes leads from daily priority + leads list.
 * No hardcoded 0s - all data from API.
 */
function useBacklogEngine(daily, leads) {
  return useMemo(() => {
    const leadIds = daily?.leadIds || {};
    const counts = daily?.counts || {};
    const actionOrder = daily?.actionOrder || ['overdue', 'weekend_missed', 'hot', 'today_scheduled', 'new'];

    const leadIdToCategory = new Map();
    TAB_KEYS.forEach((key) => {
      const ids = leadIds[LEAD_IDS_KEY_MAP[key] || key] || [];
      ids.forEach((id) => {
        if (!leadIdToCategory.has(id)) leadIdToCategory.set(id, key);
      });
    });

    const categorized = {};
    TAB_KEYS.forEach((k) => { categorized[k] = []; });
    (leads || []).forEach((lead) => {
      const id = lead.id || lead._id;
      const cat = leadIdToCategory.get(id);
      if (cat) categorized[cat].push(lead);
    });

    categorized.weekend_missed.sort((a, b) => new Date(a.submittedAt || 0) - new Date(b.submittedAt || 0));
    categorized.new.sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));

    const getTaskPriority = () => ({
      overdue: (counts.overdue ?? 0) || (counts.overdueFollowUps ?? 0) + (counts.overdueTodos ?? 0),
      overdueLeads: counts.overdueFollowUps ?? 0, // Unique leads (includes missed-session leads, deduped by backend)
      weekendMissed: counts.weekendMissed ?? 0,
      hot: counts.hotLeadsPending ?? 0,
      todayScheduled: counts.todayScheduled ?? 0,
      new: counts.newLeads ?? 0,
    });

    const ids = leadIds.overdue?.length ? leadIds.overdue : (leadIds.weekendMissed?.length ? leadIds.weekendMissed : leadIds.hot);
    let oldestHighPriorityLead = null;
    if (ids?.length && leads?.length) {
      const leadMap = new Map(leads.map((l) => [l.id || l._id, l]));
      for (const id of ids) {
        const lead = leadMap.get(id);
        if (lead) {
          oldestHighPriorityLead = lead;
          break;
        }
      }
    }

    return {
      categorized,
      counts: getTaskPriority(),
      actionOrder,
      leadIdToCategory,
      oldestHighPriorityLead,
    };
  }, [daily, leads]);
}

const CounselorDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [daily, setDaily] = useState(null);
  const [leads, setLeads] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [priorityLoading, setPriorityLoading] = useState(true);
  const [secondaryLoading, setSecondaryLoading] = useState(true);

  const todaySessions = useMemo(() => {
    const now = new Date();
    return sessions
      .filter((s) => ['SCHEDULED', 'RESCHEDULED'].includes(s.status))
      .sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate))
      .map((s) => ({
        ...s,
        isMissed: new Date(s.scheduledDate) < now,
        type: s.followUpRequired ? 'Follow-Up' : 'Counseling',
      }));
  }, [sessions]);
  const [hasMeetLink, setHasMeetLink] = useState(null);
  const [activeFilter, setActiveFilter] = useState(null);
  const [lastSynced, setLastSynced] = useState(null);
  const [snapshotModalType, setSnapshotModalType] = useState(null);
  const [selectedLeadDetails, setSelectedLeadDetails] = useState(null);

  const counselorId = user?.counselorProfile?.id || user?.counselorProfile?._id;
  const { presence, recordLogin, refreshStatus } = usePresenceTracking(counselorId);
  const [workStatusBusy, setWorkStatusBusy] = useState(false);
  const [breakModalOpen, setBreakModalOpen] = useState(false);
  const [breakType, setBreakType] = useState('Lunch');
  const [breakCustomReason, setBreakCustomReason] = useState('');
  const [timerTick, setTimerTick] = useState(0); // force re-render every second when clocked in
  const backlog = useBacklogEngine(daily, leads);

  // Summary counts for stat cards (from existing stats + leads)
  const leadSummaryCounts = useMemo(() => {
    const total = stats?.totalLeads ?? leads.length;
    // For consistency with the "New Leads" list below, always derive from the leads array
    const newCount = leads.filter((l) => l.status === 'NEW').length;
    const followUpNeeded = leads.filter((l) => l.status === 'FOLLOW_UP').length;
    const followUpScheduled = todaySessions.filter((s) => s.followUpRequired).length;
    const interested = leads.filter((l) => l.status === 'CONTACTED').length;
    const notInterested = leads.filter((l) => l.status === 'REJECTED').length;
    const missedMeetings = todaySessions.filter((s) => s.isMissed).length;
    const admissionsConfirmed = stats?.enrolled ?? leads.filter((l) => l.status === 'ENROLLED').length;
    // "Applications in Progress" = all leads except NEW and ADMISSION CONFIRMED
    const applicationsInProgress = Math.max(
      0,
      total - newCount - admissionsConfirmed,
    );
    return {
      total,
      newCount,
      followUpNeeded,
      followUpScheduled,
      interested,
      notInterested,
      missedMeetings,
      admissionsConfirmed,
      applicationsInProgress,
    };
  }, [stats, leads, todaySessions]);

  // Follow-up leads: status FOLLOW_UP (and CONTACTED with follow-up session); join with today's sessions for time/mode
  const followUpLeadsForTable = useMemo(() => {
    const followUpLeads = leads.filter((l) => l.status === 'FOLLOW_UP' || l.status === 'CONTACTED');
    return followUpLeads.map((lead) => {
      const session = sessions.find((s) => s.leadId === (lead.id || lead._id) && ['SCHEDULED', 'RESCHEDULED'].includes(s.status));
      const mode = session?.meetingType === 'AUDIO' ? 'Audio Call' : session?.meetingType === 'VIDEO' ? 'Video Call' : 'Face to Face';
      return {
        lead,
        session,
        followUpType: session ? 'Scheduled' : 'Follow-up',
        followUpTime: session ? format(new Date(session.scheduledDate), 'MMM d, h:mm a') : '—',
        mode,
      };
    }).sort((a, b) => {
      if (a.session && !b.session) return -1;
      if (!a.session && b.session) return 1;
      if (a.session && b.session) return new Date(a.session.scheduledDate) - new Date(b.session.scheduledDate);
      return 0;
    });
  }, [leads, sessions]);

  // High conversion: CONTACTED (interested)
  const highConversionLeadsList = useMemo(() => {
    return leads.filter((l) => l.status === 'CONTACTED').slice(0, 12);
  }, [leads]);

  // Admission Confirmed list (with payment display, same logic as Sessions tab)
  const admissionConfirmedLeads = useMemo(
    () =>
      (leads || [])
        .map((lead) => {
          if (!lead) return lead;
          if (lead.admissionPaymentDisplay) return lead;
          const notes = lead.notes || '';
          let admissionPaymentDisplay = null;
          if (/ONLINE/i.test(notes) && /UTR/i.test(notes)) {
            const match = notes.match(/UTR\s+([A-Za-z0-9\-]+)/i);
            if (match && match[1]) {
              admissionPaymentDisplay = `Online – UTR ${match[1]}`;
            } else {
              admissionPaymentDisplay = 'Online';
            }
          } else if (/CASH/i.test(notes)) {
            admissionPaymentDisplay = 'Cash';
          }
          return admissionPaymentDisplay
            ? { ...lead, admissionPaymentDisplay }
            : lead;
        })
        .filter((lead) => lead?.classification === 'ADMISSION_CONFIRMED'),
    [leads],
  );

  // Restore all caches immediately so UI shows data fast (stale-while-revalidate)
  useEffect(() => {
    if (!counselorId) return;
    const cachedStats = getCachedStats(counselorId);
    if (cachedStats) setStats(cachedStats);
    const cachedLeads = getCachedLeads(counselorId);
    if (cachedLeads?.length) setLeads(cachedLeads);
    const cachedSessions = getCachedSessions(counselorId);
    if (cachedSessions?.length) setSessions(cachedSessions);
  }, [counselorId]);

  const [checklist, setChecklist] = useState(() => {
    try {
      const raw = localStorage.getItem(getChecklistStorageKey());
      if (raw) {
        const o = JSON.parse(raw);
        return { ...o };
      }
    } catch (_) {}
    return {};
  });

  const setChecklistItem = useCallback((key, checked) => {
    setChecklist((prev) => {
      const next = { ...prev, [key]: !!checked };
      try {
        localStorage.setItem(getChecklistStorageKey(), JSON.stringify(next));
      } catch (_) {}
      return next;
    });
  }, []);

  const refreshData = useCallback(() => {
    if (!counselorId) return;
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
    const startOfDay = new Date(y, m, d, 0, 0, 0, 0);
    const endOfDay = new Date(y, m, d, 23, 59, 59, 999);

    // Show cached data immediately so UI feels instant and avoid flashing loaders
    const cachedDaily = getCachedDaily(counselorId);
    const cachedLeads = getCachedLeads(counselorId);
    const cachedSessions = getCachedSessions(counselorId);
    const cachedStats = getCachedStats(counselorId);

    if (cachedDaily) {
      setDaily(cachedDaily);
      setLastSynced(new Date());
    }
    if (cachedLeads?.length) {
      setLeads(cachedLeads);
    }
    if (cachedSessions?.length) {
      setSessions(cachedSessions);
    }
    if (cachedStats) {
      setStats(cachedStats);
    }

    const hasAnyCache = !!(cachedDaily || cachedLeads?.length || cachedSessions?.length || cachedStats);

    setPriorityLoading(!cachedDaily);
    // Only show skeletons/spinners when we truly have nothing cached
    setSecondaryLoading(!hasAnyCache);
    setLoading(!hasAnyCache);

    // Fire all requests in parallel — update state as each resolves (progressive loading)
    const dailyPromise = counselorAPI.getDailyPriority(counselorId)
      .then((res) => {
        const data = res.data?.data || null;
        setDaily(data);
        if (data) setCachedDaily(counselorId, data);
        setLastSynced(new Date());
        return data;
      })
      .catch(() => {
        toast.error('Failed to load today\'s plan');
        return null;
      })
      .finally(() => setPriorityLoading(false));

    const leadsPromise = counselorAPI.getLeads(counselorId)
      .then((res) => {
        const list = res.data?.data?.leads || [];
        setLeads(list);
        setCachedLeads(counselorId, list);
        return list;
      })
      .catch(() => {
        toast.error('Failed to load leads');
        return [];
      });

    const sessionsPromise = sessionAPI.getAll({
      startDate: startOfDay.toISOString(),
      endDate: endOfDay.toISOString(),
      limit: 50,
    })
      .then((res) => {
        const list = res.data?.data?.sessions || [];
        setSessions(list);
        setCachedSessions(counselorId, list);
        return list;
      })
      .catch(() => {
        toast.error('Failed to load sessions');
        return [];
      });

    const statsPromise = counselorAPI.getStats(counselorId)
      .then((res) => {
        const data = res.data?.data;
        setStats(data);
        if (data) setCachedStats(counselorId, data);
        return data;
      })
      .catch(() => {
        toast.error('Failed to load dashboard data');
        return null;
      })
      .finally(() => setLoading(false));

    // secondaryLoading clears when leads + sessions are done (main content)
    Promise.all([leadsPromise, sessionsPromise]).finally(() => setSecondaryLoading(false));
  }, [counselorId]);

  useEffect(() => {
    if (counselorId) recordLogin();
  }, [counselorId, recordLogin]);

  useEffect(() => {
    if (counselorId) {
      refreshData();
    }
  }, [counselorId, refreshData]);

  useEffect(() => {
    if (!counselorId) return;
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshData();
      }
    }, 180000); // refresh every 3 minutes only when tab is visible
    return () => clearInterval(interval);
  }, [counselorId, refreshData]);

  useEffect(() => {
    if (counselorId) {
      counselorAPI
        .getMeetLink(counselorId)
        .then((res) => setHasMeetLink(!!(res.data?.data?.staticMeetLink || '').trim()))
        .catch(() => setHasMeetLink(false));
    } else {
      setHasMeetLink(null);
    }
  }, [counselorId]);


  const fetchStats = async () => {
    try {
      const id = user?.counselorProfile?.id || user?.counselorProfile?._id;
      if (!id) return;
      setLoading(true);
      const response = await counselorAPI.getStats(id);
      const data = response.data.data;
      setStats(data);
      if (data) setCachedStats(id, data);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'ACTIVE':
      case 'ONLINE':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'AWAY':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'ON_BREAK':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'IN_MEETING':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'OFFLINE':
        return 'bg-slate-100 text-slate-800 border-slate-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const handleClockIn = async () => {
    setWorkStatusBusy(true);
    try {
      await presenceAPI.clockIn();
      await refreshStatus();
      toast.success('Clocked in');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to clock in');
    } finally {
      setWorkStatusBusy(false);
    }
  };

  const handleClockOut = async () => {
    setWorkStatusBusy(true);
    try {
      await presenceAPI.clockOut();
      await refreshStatus();
      toast.success('Clocked out');
    } catch (e) {
      const msg = e.response?.data?.message || e.message || 'Failed to clock out';
      toast.error(msg);
    } finally {
      setWorkStatusBusy(false);
    }
  };

  const handleBreakStartSubmit = async () => {
    if (breakType === 'Custom Reason' && !breakCustomReason?.trim()) {
      toast.error('Please enter a reason for custom break.');
      return;
    }
    setWorkStatusBusy(true);
    try {
      await presenceAPI.breakStart({
        reason: breakType === 'Custom Reason' ? 'Custom Reason' : breakType,
        customReason: breakType === 'Custom Reason' ? breakCustomReason?.trim() : undefined,
      });
      setBreakModalOpen(false);
      setBreakType('Lunch');
      setBreakCustomReason('');
      await refreshStatus();
      toast.success('Break started');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to start break');
    } finally {
      setWorkStatusBusy(false);
    }
  };

  const handleBreakEnd = async () => {
    setWorkStatusBusy(true);
    try {
      await presenceAPI.breakEnd();
      await refreshStatus();
      toast.success('Break ended');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to end break');
    } finally {
      setWorkStatusBusy(false);
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatClockStartedAt = (dateString) => {
    if (!dateString) return 'N/A';
    return format(new Date(dateString), 'hh:mm:ss a').toLowerCase();
  };

  const clockInAt = presence?.clockInAt ? new Date(presence.clockInAt) : null;
  const clockOutAt = presence?.clockOutAt ? new Date(presence.clockOutAt) : null;
  const breakStartAt = presence?.breakStartAt ? new Date(presence.breakStartAt) : null;
  const breakEndAt = presence?.breakEndAt ? new Date(presence.breakEndAt) : null;

  const isClockedIn = !!clockInAt && presence?.status !== 'OFFLINE';
  const isOnBreak =
    !!clockInAt &&
    !!breakStartAt &&
    (!breakEndAt || breakEndAt < clockOutAt || presence?.status === 'ON_BREAK' || presence?.status === 'IN_MEETING') &&
    ['ON_BREAK', 'IN_MEETING'].includes(presence?.status || '');

  const elapsedSeconds = useMemo(() => {
    if (!clockInAt || !isClockedIn) return 0;
    const now = Date.now();
    let workedMs = now - clockInAt.getTime();
    // Subtract break duration (single active or most recent break)
    if (breakStartAt) {
      const breakEnd = breakEndAt && breakEndAt.getTime() > breakStartAt.getTime()
        ? breakEndAt.getTime()
        : isOnBreak
          ? now
          : null;
      if (breakEnd) {
        workedMs -= Math.max(0, breakEnd - breakStartAt.getTime());
      }
    }
    return Math.max(0, Math.floor(workedMs / 1000));
  }, [clockInAt?.getTime(), breakStartAt?.getTime(), breakEndAt?.getTime(), isClockedIn, isOnBreak, timerTick]);

  const formatElapsed = (totalSeconds) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
  };

  useEffect(() => {
    if (!isClockedIn) return;
    const interval = setInterval(() => setTimerTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isClockedIn]);

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const displayName = daily?.greeting?.displayName || user?.fullName || user?.counselorProfile?.fullName || user?.username || 'Counselor';
  const c = backlog.counts;
  const overdue = c.overdue;
  const overdueLeads = c.overdueLeads ?? c.overdueFollowUps ?? 0; // Leads only — for Overdue card & details
  const weekendMissed = c.weekendMissed;
  const hotLeads = c.hot;
  const todayScheduled = c.todayScheduled;
  const newLeads = c.new;
  const pendingTotal = overdue + weekendMissed;

  const missionStatement = (() => {
    if (overdueLeads === 0 && weekendMissed === 0 && overdue === 0) {
      return 'All caught up! You\'re ready for your new leads today.';
    }
    if (weekendMissed > 0 && (daily?.isMondayOrTuesday || overdueLeads === 0)) {
      return `Priority: Clear the weekend backlog of ${weekendMissed} lead${weekendMissed !== 1 ? 's' : ''} before touching today's new arrivals.`;
    }
    if (overdueLeads > 0) {
      return `Attention: You have ${overdueLeads} parent${overdueLeads !== 1 ? 's' : ''} waiting for a callback. Start here.`;
    }
    if (hotLeads > 0) return `Work on ${hotLeads} priority lead${hotLeads !== 1 ? 's' : ''} next.`;
    if (todayScheduled > 0) return `Attend ${todayScheduled} scheduled call${todayScheduled !== 1 ? 's' : ''} today.`;
    if (newLeads > 0) return `Work on ${newLeads} new lead${newLeads !== 1 ? 's' : ''}.`;
    return 'All caught up! You\'re ready for your new leads today.';
  })();

  const newLeadsLocked = (weekendMissed > 5 || overdue > 5);
  const checklistCompleted = CHECKLIST_KEYS.filter((k) => checklist[k]).length;

  // Start Your Day: dynamic order & enablement based on what actually exists
  const checklistConfig = useMemo(() => {
    const pendingFromLastWeek = daily?.weeklySnapshot?.pendingFromLastWeek ?? 0;
    const taskCounts = {
      call_overdue: overdueLeads + weekendMissed,
      update_summaries: pendingFromLastWeek,
      attend_scheduled: todayScheduled,
      complete_hot: hotLeads,
      new_leads: newLeads,
    };
    const baseOrder = ['call_overdue', 'update_summaries', 'attend_scheduled', 'complete_hot', 'new_leads'];
    const tasks = baseOrder.map((key) => ({
      key,
      label: CHECKLIST_LABELS[key] || key,
      count: taskCounts[key] ?? 0,
      hasWork: (taskCounts[key] ?? 0) > 0,
    }));
    tasks.sort((a, b) => {
      if (a.hasWork && !b.hasWork) return -1;
      if (!a.hasWork && b.hasWork) return 1;
      return baseOrder.indexOf(a.key) - baseOrder.indexOf(b.key);
    });
    return tasks;
  }, [daily, overdueLeads, weekendMissed, todayScheduled, hotLeads, newLeads]);

  const tabConfig = useMemo(() => {
    const order = backlog.actionOrder || TAB_KEYS;
    const configs = {
      overdue: { label: 'Overdue', count: overdueLeads, color: 'red', rank: 1, path: '/counselor/todos' },
      weekend_missed: { label: 'Weekend Missed', count: weekendMissed, color: 'rose', rank: 2, path: '/counselor/leads' },
      hot: { label: 'Priority Leads', count: hotLeads, color: 'orange', rank: 3, path: '/counselor/leads' },
      today_scheduled: { label: 'Today Scheduled', count: todayScheduled, color: 'blue', rank: 4, path: '/counselor/sessions' },
      new: { label: 'New Leads', count: newLeads, color: 'gray', rank: 5, path: '/counselor/leads', locked: newLeadsLocked },
    };
    return order.map((key, i) => ({ key, ...configs[key], rank: i + 1 }));
  }, [backlog.actionOrder, overdueLeads, weekendMissed, hotLeads, todayScheduled, newLeads, newLeadsLocked]);

  // Enriched info for "Next Task Suggestion" card
  const nextTaskDetails = useMemo(() => {
    const lead = backlog.oldestHighPriorityLead;
    if (!lead) return null;

    // Find the most recent session for this lead
    const leadId = lead.id || lead._id;
    const relatedSessions = (sessions || []).filter((s) => s.leadId === leadId);
    let lastSession = null;
    if (relatedSessions.length) {
      lastSession = [...relatedSessions].sort(
        (a, b) => new Date(b.scheduledDate) - new Date(a.scheduledDate),
      )[0];
    }

    let lastMeetingLabel = null;
    if (lastSession) {
      const when = format(new Date(lastSession.scheduledDate), 'MMM d, h:mm a');
      const missedStatuses = ['NOT_CONNECTED', 'NO_SHOW_PARENT', 'NO_SHOW_COUNSELOR'];
      const isMissed =
        missedStatuses.includes(lastSession.status) ||
        lead.status === 'CALL_NOT_CONNECTED';
      if (isMissed) {
        lastMeetingLabel = `Last meeting missed on ${when}`;
      } else {
        lastMeetingLabel = `Last meeting scheduled on ${when}`;
      }
    }

    // Determine what the counselor should do next
    let actionHint = 'Follow up with this lead';
    switch (lead.status) {
      case 'NEW':
        actionHint = 'Need to schedule meeting';
        break;
      case 'FOLLOW_UP':
        actionHint = 'Need to call for follow-up';
        break;
      case 'FOLLOW_UP_SCHEDULED':
      case 'ON_HOLD':
        actionHint = 'Attend scheduled meeting';
        break;
      case 'CONTACTED':
        actionHint = 'Need to confirm admission/payment';
        break;
      case 'CALL_NOT_CONNECTED':
        actionHint = 'Need to reschedule missed meeting';
        break;
      default:
        break;
    }

    return { lead, lastMeetingLabel, actionHint };
  }, [backlog.oldestHighPriorityLead, sessions]);

  const handleStartSession = () => {
    navigate('/counselor/sessions');
  };

  // Same behavior as Sessions tab "Join Meet": open meeting link in new tab
  const handleJoinSession = (session) => {
    if (session.meetingType === 'AUDIO') return;
    const link = session.meeting_link || session.meetingLink;
    if (!link) {
      toast.error('No meeting link set for this session.');
      return;
    }
    window.open(link, '_blank', 'noopener,noreferrer');
  };

  const tabIcons = {
    overdue: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    ),
    weekend_missed: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
    ),
    hot: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /></svg>
    ),
    today_scheduled: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
    ),
    new: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
    ),
  };

  return (
    <div className="min-h-screen bg-slate-50/80">
      {/* Top header – compact Admissions-style with small clock controls */}
      <div className="relative mb-6 rounded-2xl overflow-hidden bg-gradient-to-r from-blue-600 via-blue-500 to-sky-500 text-white shadow-md">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_left,_#ffffff33,_transparent_55%),radial-gradient(circle_at_bottom_right,_#0ea5e933,_transparent_55%)]" />
        <div className="relative px-6 py-5 sm:px-8 sm:py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Left: compact clock controls (Clocked in + buttons) */}
          <div className="flex items-center gap-3 text-xs sm:text-sm">
            <span className="font-medium">
              Clocked in:{' '}
              <span className="font-semibold">
                {isClockedIn
                  ? format(new Date(presence?.clockInAt), 'hh:mm a')
                  : 'Not yet'}
              </span>
            </span>
            {!isClockedIn ? (
              <>
                <button
                  type="button"
                  disabled={workStatusBusy}
                  onClick={handleClockIn}
                  className="inline-flex items-center gap-1 rounded bg-emerald-500 px-3 py-1 text-[11px] font-semibold shadow-sm hover:bg-emerald-400 disabled:opacity-60"
                >
                  Clock In
                </button>
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-1 rounded bg-rose-400/60 px-3 py-1 text-[11px] font-semibold opacity-60 cursor-not-allowed"
                >
                  Clock Out
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={workStatusBusy}
                  onClick={() =>
                    isOnBreak ? handleBreakEnd() : setBreakModalOpen(true)
                  }
                  className={`inline-flex items-center gap-1 rounded px-3 py-1 text-[11px] font-semibold shadow-sm disabled:opacity-60 ${
                    isOnBreak
                      ? 'bg-amber-500 hover:bg-amber-400'
                      : 'bg-emerald-500 hover:bg-emerald-400'
                  }`}
                >
                  {isOnBreak ? 'End Break' : 'Start Break'}
                </button>
                <button
                  type="button"
                  disabled={workStatusBusy}
                  onClick={handleClockOut}
                  className="inline-flex items-center gap-1 rounded bg-rose-500 px-3 py-1 text-[11px] font-semibold shadow-sm hover:bg-rose-400 disabled:opacity-60"
                >
                  Clock Out
                </button>
              </>
            )}
          </div>

          {/* Center: greeting / title */}
          <div className="flex-1 text-center md:text-left">
            <p className="text-[11px] sm:text-xs font-medium text-blue-100 uppercase tracking-[0.16em]">
              Counselor Portal
            </p>
            <h1 className="mt-0.5 text-xl sm:text-2xl font-extrabold tracking-tight">
              Welcome Back, {displayName}
            </h1>
            <div className="mt-0.5 flex flex-col sm:flex-row sm:items-center sm:gap-3 text-[11px] sm:text-xs text-blue-100/95">
              <span>Admissions Dashboard</span>
              {clockInAt && (
                <span className="sm:border-l sm:border-blue-300/40 sm:pl-3">
                  Elapsed:&nbsp;
                  <span className="font-semibold">
                    {formatElapsed(elapsedSeconds)}
                  </span>
                  {isOnBreak && breakStartAt && (
                    <span className="ml-2 text-amber-200">
                      (On break since {format(breakStartAt, 'hh:mm a')})
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>

          {/* Right: quick actions (unchanged behaviour) */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleStartSession}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/25"
            >
              Start Session
            </button>
            <Link
              to="/counselor/leads/create"
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm hover:bg-blue-50"
            >
              + New Lead
            </Link>
          </div>
        </div>
      </div>

      {hasMeetLink === false && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-3 text-sm text-amber-800 mb-6">
          <span className="text-amber-600 flex-shrink-0"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></span>
          <span>Please generate your Google Meet link to start sessions.</span>
          <Link to="/counselor/sessions" className="shrink-0 font-medium text-amber-700 hover:text-amber-900 underline">Go to Sessions</Link>
        </div>
      )}

      {/* KPI Summary Row + Lifetime Leads */}
      <div className="mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* New Leads */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white shadow-sm px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  New Leads
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
                  {leadSummaryCounts.newCount}
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <span className="text-lg font-semibold">+</span>
              </div>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Need to schedule meeting
            </p>
          </div>

          {/* Applications in Progress */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white shadow-sm px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Applications in Progress
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
                  {leadSummaryCounts.applicationsInProgress}
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                <span className="text-lg font-semibold">📄</span>
              </div>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Pending Documents
            </p>
          </div>

          {/* Interviews Scheduled */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white shadow-sm px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Interviews Scheduled
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
                  {todaySessions.length}
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-50 text-sky-600">
                <span className="text-lg font-semibold">👥</span>
              </div>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Today&apos;s interviews
            </p>
          </div>

          {/* Lifetime Leads (Total Leads) */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white shadow-sm px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Lifetime Leads
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
                  {leadSummaryCounts.total}
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
              </div>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Total leads assigned to you till date
            </p>
          </div>
        </div>
      </div>

      {/* Main content: Today's Tasks rows + Today's Schedule (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Row 1: Scheduled Sessions */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">Scheduled Sessions</h2>
              <p className="text-sm text-slate-500">
                Today&apos;s counseling sessions with students.
              </p>
            </div>
            <div className="overflow-x-auto">
              {secondaryLoading ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3, 4].map((i) => <div key={i} className="h-12 rounded-lg bg-slate-100 animate-pulse" />)}
                </div>
              ) : todaySessions.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">
                  No sessions scheduled for today.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left py-3 px-4 font-semibold text-slate-700 w-24">
                        Time
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">
                        Student
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">
                        Type
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {todaySessions.slice(0, 8).map((session) => {
                      const sessionLead =
                        leads.find((l) => (l.id || l._id) === session.leadId) ||
                        session.lead;
                      const sessionType =
                        session.mode === 'Offline'
                          ? 'Face to Face'
                          : session.meetingType === 'VIDEO'
                            ? 'Video'
                            : 'Audio';
                      const parentPhone =
                        sessionLead?.parentMobile ||
                        sessionLead?.parentPhone ||
                        sessionLead?.phone;
                      return (
                        <tr
                          key={session.id}
                          className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50"
                        >
                          <td className="py-3 px-4 whitespace-nowrap text-slate-700">
                            {format(
                              new Date(session.scheduledDate),
                              'hh:mm a',
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-medium text-slate-900">
                              {sessionLead?.studentName ||
                                sessionLead?.parentName ||
                                'Lead'}
                            </p>
                            <p className="text-xs text-slate-500">
                              {sessionLead?.course?.name ||
                                sessionLead?.currentClass ||
                                '—'}
                            </p>
                          </td>
                          <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                            {sessionType}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedLeadDetails(
                                    sessionLead || session.lead || null,
                                  )
                                }
                                className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                              >
                                View Details
                              </button>
                              {session.mode === 'Online' &&
                              session.meetingType === 'VIDEO' ? (
                                <button
                                  type="button"
                                  onClick={() => handleJoinSession(session)}
                                  className="inline-flex items-center rounded-full bg-blue-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-blue-700"
                                >
                                  Join
                                </button>
                              ) : parentPhone ? (
                                <a
                                  href={`tel:${parentPhone}`}
                                  className="inline-flex items-center rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-emerald-700"
                                >
                                  {parentPhone}
                                </a>
                              ) : null}
                              <button
                                type="button"
                                onClick={() =>
                                  navigate('/counselor/sessions', {
                                    state: { rescheduleSession: session },
                                  })
                                }
                                className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                              >
                                Reschedule
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Row 2: New Leads */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">New Leads</h2>
              <p className="text-sm text-slate-500">
                Leads that need a counseling session to be scheduled.
              </p>
            </div>
            <div className="p-4">
              {secondaryLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-lg bg-slate-100 animate-pulse" />)}
                </div>
              ) : (() => {
                const newLeadsList = leads.filter((l) => l.status === 'NEW');
                if (newLeadsList.length === 0) {
                  return (
                    <div className="py-6 text-center text-slate-500 text-sm">
                      No new leads waiting for scheduling.
                    </div>
                  );
                }
                // Show in ascending order of when the lead came in (oldest first)
                const ordered = [...newLeadsList].sort((a, b) => {
                  const aTime = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
                  const bTime = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
                  return aTime - bTime;
                });
                return (
                  <div className="space-y-2">
                    {ordered.slice(0, 8).map((lead) => {
                      const id = lead.id || lead._id;
                      return (
                        <div
                          key={id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2 hover:bg-slate-50"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">
                              {lead.studentName || lead.parentName || 'Lead'}
                            </p>
                            <p className="text-xs text-slate-500">
                              {lead.course?.name ||
                                lead.importedCourseName ||
                                lead.currentClass ||
                                '—'}
                            </p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Assigned:{' '}
                              {lead.submittedAt
                                ? format(new Date(lead.submittedAt), 'MMM d, yyyy hh:mm a')
                                : '—'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              navigate('/counselor/sessions', {
                                state: { scheduleLead: lead },
                              })
                            }
                            className="inline-flex items-center rounded-full bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700"
                          >
                            Schedule
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Row 3: Admission Confirmation Pending */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">
                Admission Confirmation Pending
              </h2>
              <p className="text-sm text-slate-500">
                Contacted &amp; interested students waiting for payment
                confirmation.
              </p>
            </div>
            <div className="p-4">
              {secondaryLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-16 rounded-lg bg-slate-100 animate-pulse"
                    />
                  ))}
                </div>
              ) : (() => {
                const pending = (leads || []).filter(
                  (lead) =>
                    lead &&
                    lead.status === 'CONTACTED' &&
                    lead.classification !== 'ADMISSION_CONFIRMED',
                );
                if (pending.length === 0) {
                  return (
                    <div className="py-6 text-center text-slate-500 text-sm">
                      No leads are currently pending admission confirmation.
                    </div>
                  );
                }
                return (
                  <div className="space-y-2">
                    {pending.slice(0, 8).map((lead) => (
                      <div
                        key={lead.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2 hover:bg-slate-50"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {lead.studentName || lead.parentName || 'Lead'}
                          </p>
                          <p className="text-xs text-slate-500">
                            Status: Contacted &amp; Interested (Ready to take
                            admission)
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            navigate('/counselor/sessions', {
                              state: { admissionProofLead: lead },
                            })
                          }
                          className="inline-flex items-center rounded-full bg-emerald-700 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-800"
                        >
                          Attach Admission Proof
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
        {/* Right side: Today's Progress + Next Task Suggestion */}
        <div className="lg:col-span-1">
          <div className="space-y-4 sticky top-4">
            {/* Today's Progress card (like reference) */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">
                Today&apos;s Progress
              </h3>
              <dl className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <dt className="flex items-center gap-1 text-slate-600">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    Leads Assigned:
                  </dt>
                  <dd className="font-semibold text-slate-900">
                    {leadSummaryCounts.total}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="flex items-center gap-1 text-slate-600">
                    <span className="h-2 w-2 rounded-full bg-sky-400" />
                    Leads Contacted:
                  </dt>
                  <dd className="font-semibold text-slate-900">
                    {leadSummaryCounts.interested + leadSummaryCounts.notInterested}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="flex items-center gap-1 text-slate-600">
                    <span className="h-2 w-2 rounded-full bg-violet-400" />
                    Sessions Completed:
                  </dt>
                  <dd className="font-semibold text-slate-900">
                    {stats?.enrolled ?? 0}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="flex items-center gap-1 text-slate-600">
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                    Pending Confirmations:
                  </dt>
                  <dd className="font-semibold text-slate-900">
                    {leadSummaryCounts.followUpNeeded}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Next Task Suggestion card */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">
                Next Task Suggestion
              </h3>
              {nextTaskDetails ? (
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-sky-100 flex items-center justify-center text-sky-700 font-semibold text-sm">
                    {(nextTaskDetails.lead.studentName ||
                      nextTaskDetails.lead.parentName ||
                      'L')[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      Call{' '}
                      {nextTaskDetails.lead.studentName ||
                        nextTaskDetails.lead.parentName ||
                        'Lead'}
                    </p>
                    {nextTaskDetails.lastMeetingLabel && (
                      <p className="text-[11px] text-slate-500">
                        {nextTaskDetails.lastMeetingLabel}
                      </p>
                    )}
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {nextTaskDetails.actionHint}
                    </p>
                  </div>
                  <Link
                    to={`/counselor/leads/${nextTaskDetails.lead.id || nextTaskDetails.lead._id}`}
                    className="inline-flex items-center rounded-full bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700"
                  >
                    Call Lead
                  </Link>
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  You&apos;re all caught up. New high-priority leads will appear
                  here.
                </p>
              )}
            </div>

            {/* Admission Confirmed card (same as Sessions tab) */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">
                Admission Confirmed
              </h3>
              {admissionConfirmedLeads.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No students have been marked as admission confirmed yet.
                </p>
              ) : (
                <ul className="space-y-3 max-h-[260px] overflow-y-auto">
                  {admissionConfirmedLeads.map((lead) => (
                    <li
                      key={lead.id}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-xs flex flex-col gap-1.5"
                    >
                      <div className="flex justify-between gap-2">
                        <span className="font-medium text-slate-900 truncate">
                          {lead.studentName || lead.parentName || 'Student'}
                        </span>
                        <span className="text-[11px] text-slate-500 shrink-0">
                          {lead.leadId}
                        </span>
                      </div>
                      <div className="text-[11px] text-emerald-700">
                        Status: <span className="font-semibold">Admission Confirmed</span>
                      </div>
                      <div className="text-[11px] text-slate-700">
                        Payment:{' '}
                        <span className="font-medium">
                          {lead.admissionPaymentDisplay || '—'}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Lead Details modal for Scheduled Sessions */}
      {selectedLeadDetails && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSelectedLeadDetails(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white shadow-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {selectedLeadDetails.studentName ||
                    selectedLeadDetails.parentName ||
                    'Lead details'}
                </h3>
                <p className="text-xs text-slate-500">
                  Full information for this scheduled session.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLeadDetails(null)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium text-slate-500">
                    Student Name
                  </p>
                  <p className="mt-0.5 font-semibold text-slate-900">
                    {selectedLeadDetails.studentName || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">
                    Parent Name
                  </p>
                  <p className="mt-0.5 font-semibold text-slate-900">
                    {selectedLeadDetails.parentName || '—'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium text-slate-500">
                    Parent Mobile
                  </p>
                  <p className="mt-0.5 text-slate-900">
                    {selectedLeadDetails.parentMobile || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">
                    Parent Email
                  </p>
                  <p className="mt-0.5 text-slate-900 break-all">
                    {selectedLeadDetails.parentEmail || '—'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium text-slate-500">
                    Class / Course
                  </p>
                  <p className="mt-0.5 text-slate-900">
                    {selectedLeadDetails.course?.name ||
                      selectedLeadDetails.currentClass ||
                      '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">
                    Institution
                  </p>
                  <p className="mt-0.5 text-slate-900">
                    {selectedLeadDetails.institution?.name || '—'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium text-slate-500">Status</p>
                  <p className="mt-0.5 text-slate-900">
                    {selectedLeadDetails.status || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">
                    Classification
                  </p>
                  <p className="mt-0.5 text-slate-900">
                    {selectedLeadDetails.classification || '—'}
                  </p>
                </div>
              </div>

              {selectedLeadDetails.notes && (
                <div>
                  <p className="text-xs font-medium text-slate-500">Notes</p>
                  <p className="mt-0.5 text-xs text-slate-700 whitespace-pre-wrap">
                    {selectedLeadDetails.notes}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedLeadDetails(null)}
                className="inline-flex items-center rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
              {selectedLeadDetails.id && (
                <Link
                  to={`/counselor/leads/${selectedLeadDetails.id}`}
                  className="inline-flex items-center rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  Open full profile
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Break Start modal */}
      {breakModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setBreakModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900 mb-4">Break Start</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Break Type <span className="text-red-500">*</span></label>
              <select
                value={breakType}
                onChange={(e) => setBreakType(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="Lunch">Lunch</option>
                <option value="Tea Break">Tea Break</option>
                <option value="Officework">Officework</option>
                <option value="Personal Break">Personal Break</option>
                <option value="In a Meeting">In a Meeting</option>
                <option value="Coffee break">Coffee break</option>
                <option value="Custom Reason">Custom Reason</option>
              </select>
              {breakType === 'Custom Reason' && (
                <input
                  type="text"
                  value={breakCustomReason}
                  onChange={(e) => setBreakCustomReason(e.target.value)}
                  placeholder="Enter reason"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setBreakModalOpen(false)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold text-sm hover:bg-slate-50"
              >
                <X className="w-4 h-4" />
                Close
              </button>
              <button
                type="button"
                disabled={workStatusBusy}
                onClick={handleBreakStartSubmit}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white font-semibold text-sm hover:bg-violet-700 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                Start Break
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CounselorDashboard;
