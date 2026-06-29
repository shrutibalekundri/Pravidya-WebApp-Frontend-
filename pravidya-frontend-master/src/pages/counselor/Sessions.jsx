import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Phone } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { sessionAPI, counselorAPI, leadAPI } from '../../services/api';
import {
  startOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  addMonths,
  subMonths,
  addMinutes,
  format,
  isSameDay,
  isAfter,
  isBefore,
  startOfDay,
  endOfDay,
  getDaysInMonth,
  differenceInDays,
} from 'date-fns';
import toast from 'react-hot-toast';

const SLOT_DURATION_MINUTES = 30; // grid granularity only
const DAY_START_HOUR = 10;
const DAY_END_HOUR = 18; // last visible grid row ends at 18:00

// Lightweight cache so the Sessions page feels instant when revisiting
const CACHE_KEY_SESSIONS_PAGE = 'counselor_sessions_page';

function getCachedSessionsPage(counselorId) {
  try {
    const raw = sessionStorage.getItem(`${CACHE_KEY_SESSIONS_PAGE}_${counselorId || 'anon'}`);
    if (!raw) return null;
    const { data, ts, range } = JSON.parse(raw);
    if (!Array.isArray(data)) return null;
    // basic staleness guard – 5 minutes
    if (Date.now() - ts > 5 * 60 * 1000) return null;
    return { data, range };
  } catch {
    return null;
  }
}

function setCachedSessionsPage(counselorId, data, range) {
  try {
    sessionStorage.setItem(
      `${CACHE_KEY_SESSIONS_PAGE}_${counselorId || 'anon'}`,
      JSON.stringify({ data: data || [], range, ts: Date.now() }),
    );
  } catch {
    // ignore cache errors
  }
}

function generateTimeSlots() {
  const slots = [];
  let current = new Date();
  current.setHours(DAY_START_HOUR, 0, 0, 0);
  const end = new Date();
  end.setHours(DAY_END_HOUR, 0, 0, 0);

  while (current < end) {
    const start = new Date(current);
    const finish = addMinutes(start, SLOT_DURATION_MINUTES);
    slots.push({
      label: `${format(start, 'h:mm a')} – ${format(finish, 'h:mm a')}`,
      startHour: start.getHours(),
      startMinute: start.getMinutes(),
    });
    current = finish;
  }
  return slots;
}

const TIME_SLOTS = generateTimeSlots();

// Lead status options for "Leads Requiring Status Update"
// (labels shown to counselors; values map to backend enums/fields)
const LEAD_STATUS_UPDATE_OPTIONS = [
  { label: 'New', value: 'NEW' },
  { label: 'Meeting Scheduled', value: 'ON_HOLD' },
  { label: 'Contacted & Interested', value: 'CONTACTED' },
  { label: 'Contacted & Not Interested', value: 'REJECTED' },
  { label: 'Contacted – Follow-up Needed', value: 'FOLLOW_UP' },
  { label: 'Contacted – Follow-up Scheduled', value: 'FOLLOW_UP_SCHEDULED' },
  { label: 'Missed Scheduled Meeting', value: 'CALL_NOT_CONNECTED' },
  // Admission pipeline final stage – stored as classification, not status
  { label: 'Admission Confirmed', value: 'ADMISSION_CONFIRMED' },
];

function getSessionTimeRange(session) {
  const start = new Date(session.scheduledDate);
  const end = session.endDate
    ? new Date(session.endDate)
    : addMinutes(start, SLOT_DURATION_MINUTES);
  return `${format(start, 'h:mm a')} – ${format(end, 'h:mm a')}`;
}

function getSessionMeetingLabel(session) {
  if (session.mode === 'Offline') return 'In-person';
  return session.meetingType === 'AUDIO' ? 'Audio' : 'Video';
}

function parseTime24To12(time) {
  if (!time) {
    return { hour: '10', minute: '00', ampm: 'AM' };
  }
  const [hStr, mStr] = time.split(':');
  let h = Number.parseInt(hStr || '0', 10);
  const minute = (mStr || '00').padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return { hour: String(h), minute, ampm };
}

function to24HourString(hour12, minute, ampm) {
  let h = Number.parseInt(hour12 || '0', 10) % 12;
  if (ampm === 'PM') h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${String(minute || '0').padStart(2, '0')}`;
}

const CounselorSessions = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [viewStart, setViewStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState([]);
  const [leadsLoading, setLeadsLoading] = useState(false);

  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null); // Date
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [scheduleDate, setScheduleDate] = useState(
    format(new Date(), 'yyyy-MM-dd')
  );
  const [scheduleTime, setScheduleTime] = useState('10:00'); // start time
  const [scheduleEndTime, setScheduleEndTime] = useState('10:30'); // end time
  const [notes, setNotes] = useState('');
  const [meetingMode, setMeetingMode] = useState('ONLINE'); // 'FACE_TO_FACE' | 'ONLINE'
  const [onlineMode, setOnlineMode] = useState('audio'); // 'audio' | 'video'
  const [calendarView, setCalendarView] = useState('week'); // 'today' | 'week' | 'month' | 'custom'
  const [customRangeStart, setCustomRangeStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [customRangeEnd, setCustomRangeEnd] = useState(() => endOfDay(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 6)));
  const [saving, setSaving] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [durationPreset, setDurationPreset] = useState(null); // 15 | 30 | 45 | 60 | null
  const [isFollowUpBooking, setIsFollowUpBooking] = useState(false);

  const [resolvedCounselorId, setResolvedCounselorId] = useState(null);
  const [draftMissedReasons, setDraftMissedReasons] = useState({});
  const [savingMissedSessionId, setSavingMissedSessionId] = useState(null);
  const [savingLeadStatusId, setSavingLeadStatusId] = useState(null);
  const [leadStatusFollowUpScheduled, setLeadStatusFollowUpScheduled] = useState(new Set());
  const [admissionProofLead, setAdmissionProofLead] = useState(null);
  const [admissionPaymentType, setAdmissionPaymentType] = useState('ONLINE');
  const [admissionPaymentUtr, setAdmissionPaymentUtr] = useState('');
  const [savingAdmissionProof, setSavingAdmissionProof] = useState(false);
  const counselorId =
    user?.counselorProfile?.id ?? user?.counselorProfile?._id ?? resolvedCounselorId ?? null;

  // Date range for fetching: depends on view
  const fetchRange = useMemo(() => {
    const start = startOfDay(viewStart);
    if (calendarView === 'today') {
      return { startDate: start, endDate: endOfDay(viewStart) };
    }
    if (calendarView === 'week') {
      const weekStartDate = startOfWeek(viewStart, { weekStartsOn: 1 });
      return {
        startDate: startOfDay(weekStartDate),
        endDate: endOfDay(addDays(weekStartDate, 6)),
      };
    }
    if (calendarView === 'custom') {
      const s = startOfDay(customRangeStart);
      const e = endOfDay(customRangeEnd);
      return { startDate: s <= e ? s : e, endDate: e >= s ? e : s };
    }
    // month
    return {
      startDate: startOfDay(startOfMonth(viewStart)),
      endDate: endOfDay(endOfMonth(viewStart)),
    };
  }, [viewStart, calendarView, customRangeStart, customRangeEnd]);

  // Days to show as columns in the calendar grid
  const displayDays = useMemo(() => {
    if (calendarView === 'today') {
      return [startOfDay(viewStart)];
    }
    if (calendarView === 'week') {
      const weekStartDate = startOfWeek(viewStart, { weekStartsOn: 1 });
      return Array.from({ length: 7 }, (_, i) => addDays(weekStartDate, i));
    }
    if (calendarView === 'custom') {
      const s = startOfDay(customRangeStart);
      const e = startOfDay(customRangeEnd);
      const days = Math.max(1, differenceInDays(e, s) + 1);
      return Array.from({ length: days }, (_, i) => addDays(s, i));
    }
    const monthStart = startOfMonth(viewStart);
    const daysInMonth = getDaysInMonth(viewStart);
    return Array.from({ length: daysInMonth }, (_, i) => addDays(monthStart, i));
  }, [viewStart, calendarView, customRangeStart, customRangeEnd]);

  const loadSessions = async () => {
    // use cached data immediately so revisiting the tab is instant
    const cached = getCachedSessionsPage(counselorId);
    if (cached?.data?.length) {
      setSessions(cached.data);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const params = {
        limit: 150,
        startDate: fetchRange.startDate.toISOString(),
        endDate: fetchRange.endDate.toISOString(),
      };
      const res = await sessionAPI.getAll(params);
      const list = res.data?.data?.sessions || res.data?.data || [];
      setSessions(list);
      setCachedSessionsPage(counselorId, list, {
        start: params.startDate,
        end: params.endDate,
      });
    } catch (error) {
      const msg =
        error.response?.data?.message ||
        error.message ||
        'Failed to load sessions';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const loadLeads = async () => {
    if (!counselorId) return;
    setLeadsLoading(true);
    try {
      const res = await counselorAPI.getLeads(counselorId);
      const list = res.data?.data?.leads || [];
      setLeads(list);
    } catch (error) {
      console.error('Failed to load leads for scheduling', error);
      setLeads([]);
    } finally {
      setLeadsLoading(false);
    }
  };

  const getMissedReasonForSession = (session) => {
    const draft = draftMissedReasons[session.id];
    if (draft) return { type: draft.type, customText: draft.customText ?? '' };
    return {
      type: session.missedCallReasonType || '',
      customText: session.connectionReason || '',
    };
  };

  const handleSaveMissedReason = async (session) => {
    const { type, customText } = getMissedReasonForSession(session);
    if (!type) {
      toast.error('Please select a reason (Counselor missed, Parent missed, or Custom).');
      return;
    }
    if (type === 'CUSTOM' && !customText.trim()) {
      toast.error('Please enter a custom reason.');
      return;
    }
    setSavingMissedSessionId(session.id);
    try {
      await sessionAPI.update(session.id, {
        missedCallReasonType: type,
        connectionReason: type === 'CUSTOM' ? customText.trim() : null,
      });
      setSessions((prev) =>
        prev.map((s) =>
          s.id === session.id
            ? {
                ...s,
                missedCallReasonType: type,
                connectionReason: type === 'CUSTOM' ? customText.trim() : null,
              }
            : s
        )
      );
      setDraftMissedReasons((prev) => {
        const next = { ...prev };
        delete next[session.id];
        return next;
      });
      toast.success('Missed call reason saved.');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to save reason';
      toast.error(msg);
    } finally {
      setSavingMissedSessionId(null);
    }
  };

  useEffect(() => {
    loadSessions();
  }, [fetchRange.startDate.getTime(), fetchRange.endDate.getTime()]);

  useEffect(() => {
    if (user?.role === 'COUNSELOR' && !user?.counselorProfile?.id && !user?.counselorProfile?._id) {
      counselorAPI.getMe()
        .then((res) => {
          const id = res.data?.data?.id;
          if (id) setResolvedCounselorId(id);
        })
        .catch(() => {});
    } else {
      setResolvedCounselorId(null);
    }
  }, [user?.role, user?.counselorProfile?.id, user?.counselorProfile?._id]);

  useEffect(() => {
    loadLeads();
  }, [counselorId]);

  const openScheduleModal = (slotDate, session = null) => {
    const baseDate =
      slotDate ||
      (() => {
        const today = new Date();
        today.setSeconds(0, 0);
        return today;
      })();

    const startStr = format(baseDate, 'HH:mm');
    const endStr = session?.endDate
      ? format(new Date(session.endDate), 'HH:mm')
      : format(addMinutes(baseDate, SLOT_DURATION_MINUTES), 'HH:mm');

    setSelectedSlot(baseDate);
    setScheduleDate(format(baseDate, 'yyyy-MM-dd'));
    setScheduleTime(startStr);
    setScheduleEndTime(endStr);
    setEditingSession(session);
    setSelectedLeadId(session?.lead?.id ?? session?.leadId ?? '');
    setNotes(session?.remarks || '');
    setMeetingMode(session?.mode === 'Offline' ? 'FACE_TO_FACE' : 'ONLINE');
    setOnlineMode(session?.meetingType === 'VIDEO' ? 'video' : 'audio');
    setDurationPreset(null);
    setIsFollowUpBooking(false);
    setScheduleModalOpen(true);
  };

  const closeScheduleModal = () => {
    setScheduleModalOpen(false);
    setSelectedSlot(null);
    setSelectedLeadId('');
    setNotes('');
    setScheduleEndTime('10:30');
    setDurationPreset(null);
    setMeetingMode('ONLINE');
    setOnlineMode('audio');
    setEditingSession(null);
    setIsFollowUpBooking(false);
  };

  // Open reschedule / schedule modal when navigated from Dashboard with state
  useEffect(() => {
    const state = location.state || {};
    if (state.rescheduleSession?.id) {
      const session = state.rescheduleSession;
      openScheduleModal(
        session.scheduledDate ? new Date(session.scheduledDate) : new Date(),
        session,
      );
      navigate(location.pathname, { replace: true, state: {} });
      return;
    }
    if (state.scheduleLead?.id) {
      openScheduleModalForLead(state.scheduleLead, false);
      navigate(location.pathname, { replace: true, state: {} });
      return;
    }
    if (state.admissionProofLead?.id) {
      openAdmissionProofModal(state.admissionProofLead);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  const openScheduleModalForLead = (lead, isFollowUp = false) => {
    const today = new Date();
    setSelectedSlot(today);
    setScheduleDate(format(today, 'yyyy-MM-dd'));
    setScheduleTime(format(addMinutes(today, 30), 'HH:mm'));
    setScheduleEndTime(format(addMinutes(today, 60), 'HH:mm'));
    setEditingSession(null);
    setSelectedLeadId(lead?.id ?? '');
    setNotes('');
    setMeetingMode('ONLINE');
    setOnlineMode('audio');
    setDurationPreset(null);
    setIsFollowUpBooking(!!isFollowUp);
    setScheduleModalOpen(true);
  };

  const handleLeadStatusUpdate = async (leadId, optionValue) => {
    // Special handling for "Admission Confirmed": this is modeled as a lead
    // classification in the backend, not a LeadStatus enum value.
    if (optionValue === 'ADMISSION_CONFIRMED') {
      setSavingLeadStatusId(leadId);
      try {
        await leadAPI.update(leadId, { classification: 'ADMISSION_CONFIRMED' });
        setSessions((prev) =>
          prev.map((s) => {
            const lid = s.lead?.id ?? s.leadId;
            if (lid !== leadId) return s;
            return {
              ...s,
              lead: s.lead ? { ...s.lead, classification: 'ADMISSION_CONFIRMED' } : s.lead,
            };
          })
        );
        toast.success('Lead marked as Admission Confirmed.');
      } catch (err) {
        const msg =
          err.response?.data?.message ||
          err.message ||
          'Failed to mark as Admission Confirmed';
        toast.error(msg);
      } finally {
        setSavingLeadStatusId(null);
      }
      return;
    }

    const statusToSave = optionValue === 'FOLLOW_UP_SCHEDULED' ? 'FOLLOW_UP' : optionValue;
    setSavingLeadStatusId(leadId);
    setLeadStatusFollowUpScheduled((prev) => {
      const next = new Set(prev);
      if (optionValue === 'FOLLOW_UP_SCHEDULED') next.add(leadId);
      else next.delete(leadId);
      return next;
    });
    try {
      await leadAPI.update(leadId, { status: statusToSave });
      setSessions((prev) =>
        prev.map((s) => {
          const lid = s.lead?.id ?? s.leadId;
          if (lid !== leadId) return s;
          return {
            ...s,
            lead: s.lead ? { ...s.lead, status: statusToSave } : s.lead,
          };
        })
      );
      toast.success('Lead status updated.');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to update status';
      toast.error(msg);
      setLeadStatusFollowUpScheduled((prev) => {
        const next = new Set(prev);
        next.delete(leadId);
        return next;
      });
    } finally {
      setSavingLeadStatusId(null);
    }
  };

  const handleSaveSession = async (e) => {
    e.preventDefault();
    if (!selectedSlot) return;
    if (!editingSession && !selectedLeadId) {
      toast.error('Please select a student / lead.');
      return;
    }

    // Use the selected date + start/end time
    const start = new Date(`${scheduleDate}T${scheduleTime}:00`);
    const end = new Date(`${scheduleDate}T${scheduleEndTime}:00`);

    if (!(start instanceof Date) || isNaN(start.getTime())) {
      toast.error('Please choose a valid start time.');
      return;
    }
    if (!(end instanceof Date) || isNaN(end.getTime())) {
      toast.error('Please choose a valid end time.');
      return;
    }
    if (end <= start) {
      toast.error('End time must be after start time.');
      return;
    }

    // Client-side overlap check: exclude current session when rescheduling
    const sessionsOnDay = sessions.filter(
      (s) => format(new Date(s.scheduledDate), 'yyyy-MM-dd') === scheduleDate
    );
    const overlaps = sessionsOnDay.some((s) => {
      if (editingSession && s.id === editingSession.id) return false;
      const sStart = new Date(s.scheduledDate);
      const sEnd = s.endDate ? new Date(s.endDate) : addMinutes(sStart, SLOT_DURATION_MINUTES);
      return sStart < end && sEnd > start;
    });
    if (overlaps) {
      toast.error('You already have another counseling session scheduled during this time.');
      return;
    }

    setSaving(true);
    try {
      const startIso = start.toISOString();
      const endIso = end.toISOString();

      if (editingSession) {
        // Reschedule existing session using existing backend route
        await sessionAPI.reschedule(editingSession.id, {
          scheduledDate: startIso,
          endDate: endIso,
          meetingType: meetingMode === 'ONLINE' ? (onlineMode === 'video' ? 'VIDEO' : 'AUDIO') : undefined,
          remarks: notes.trim() || undefined,
        });
        toast.success('Session rescheduled');
      } else {
        // New session using existing /sessions POST
        await sessionAPI.create({
          lead: selectedLeadId,
          scheduledDate: startIso,
          endDate: endIso,
          mode: meetingMode === 'FACE_TO_FACE' ? 'Offline' : 'Online',
          meetingType:
            meetingMode === 'ONLINE'
              ? onlineMode === 'video'
                ? 'VIDEO'
                : 'AUDIO'
              : undefined,
          remarks: notes.trim() || undefined,
        });

        // Auto-update lead status based on whether this is an initial
        // meeting or a follow-up booking.
        if (selectedLeadId) {
          const nextStatus = isFollowUpBooking ? 'FOLLOW_UP' : 'ON_HOLD';
          try {
            await leadAPI.update(selectedLeadId, { status: nextStatus });
          } catch (err) {
            // Non-blocking: scheduling should still succeed even if status update fails.
            // Surface a soft warning in the console.
            // eslint-disable-next-line no-console
            console.warn('Failed to auto-update lead status after scheduling', err);
          }
        }

        toast.success('Session scheduled');
      }
      closeScheduleModal();
      // Jump calendar to the week of the scheduled session
      setViewStart(calendarView === 'today' ? startOfDay(start) : calendarView === 'month' ? startOfMonth(start) : startOfWeek(start, { weekStartsOn: 1 }));
      loadSessions();
    } catch (error) {
      const msg =
        error.response?.data?.message ||
        error.message ||
        'Failed to save session';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // For the currently selected date in the modal, compute continuous free/busy ranges
  const availabilityForSelectedDate = useMemo(() => {
    if (!scheduleDate) return [];
    const dayDate = new Date(`${scheduleDate}T00:00:00`);

    const dayStart = new Date(
      dayDate.getFullYear(),
      dayDate.getMonth(),
      dayDate.getDate(),
      DAY_START_HOUR,
      0,
      0,
      0
    );

    // First, compute busy/free for each 30-min slot
    const slotBusy = TIME_SLOTS.map((slot, index) => {
      const slotStart = addMinutes(dayStart, index * SLOT_DURATION_MINUTES);
      const slotEnd = addMinutes(slotStart, SLOT_DURATION_MINUTES);

      const busy = sessions.some((s) => {
        const sStart = new Date(s.scheduledDate);
        const sEnd = s.endDate
          ? new Date(s.endDate)
          : addMinutes(sStart, SLOT_DURATION_MINUTES);
        // overlap check: start < slotEnd && end > slotStart
        return sStart < slotEnd && sEnd > slotStart;
      });

      return { busy, slotStart, slotEnd };
    });

    // Merge consecutive slots into continuous ranges
    const ranges = [];
    let current = null;
    slotBusy.forEach(({ busy, slotStart, slotEnd }, index) => {
      if (!current) {
        current = { busy, start: slotStart, end: slotEnd };
        return;
      }
      if (busy === current.busy) {
        // extend current range
        current.end = slotEnd;
      } else {
        ranges.push(current);
        current = { busy, start: slotStart, end: slotEnd };
      }
    });
    if (current) ranges.push(current);

    return ranges;
  }, [scheduleDate, sessions]);

  // Busy slot detection: selected time range overlaps an existing session on the selected day (excluding session being edited)
  const hasBusyOverlap = useMemo(() => {
    if (!scheduleDate || !scheduleTime || !scheduleEndTime) return false;
    const start = new Date(`${scheduleDate}T${scheduleTime}:00`);
    const end = new Date(`${scheduleDate}T${scheduleEndTime}:00`);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return false;
    const onDay = sessions.filter(
      (s) => format(new Date(s.scheduledDate), 'yyyy-MM-dd') === scheduleDate
    );
    return onDay.some((s) => {
      if (editingSession && s.id === editingSession.id) return false;
      const sStart = new Date(s.scheduledDate);
      const sEnd = s.endDate ? new Date(s.endDate) : addMinutes(sStart, SLOT_DURATION_MINUTES);
      return sStart < end && sEnd > start;
    });
  }, [scheduleDate, scheduleTime, scheduleEndTime, sessions, editingSession]);

  const handleCancelSession = async (session) => {
    if (!session?.id) return;
    if (
      !window.confirm('Cancel this session? This cannot be undone.')
    ) {
      return;
    }
    try {
      await sessionAPI.delete(session.id);
      toast.success('Session cancelled');
      loadSessions();
    } catch (error) {
      const msg =
        error.response?.data?.message ||
        error.message ||
        'Failed to cancel session';
      toast.error(msg);
    }
  };

  // Session placement: for each (dayIndex, slotIndex) we store session with rowSpan so sessions occupy correct time duration
  const getSessionEnd = (s) =>
    s.endDate ? new Date(s.endDate) : addMinutes(new Date(s.scheduledDate), SLOT_DURATION_MINUTES);
  const sessionPlacementsByDay = useMemo(() => {
    const dayPlacements = displayDays.map((day) => {
      const daySessions = sessions
        .filter((s) => isSameDay(new Date(s.scheduledDate), day))
        .sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));
      const dayStart = new Date(day);
      dayStart.setHours(DAY_START_HOUR, 0, 0, 0);
      const totalSlots = TIME_SLOTS.length;
      return daySessions.map((s) => {
        const start = new Date(s.scheduledDate);
        const end = getSessionEnd(s);
        const startMinutes = start.getHours() * 60 + start.getMinutes() - DAY_START_HOUR * 60;
        const endMinutes = end.getHours() * 60 + end.getMinutes() - DAY_START_HOUR * 60;
        if (endMinutes <= 0 || startMinutes >= DAY_END_HOUR * 60 - DAY_START_HOUR * 60) return null;
        const durationMinutes = Math.max(1, Math.min(endMinutes - startMinutes, totalSlots * SLOT_DURATION_MINUTES));
        const slotIndex = Math.max(0, Math.min(Math.floor(startMinutes / SLOT_DURATION_MINUTES), totalSlots - 1));
        const rowSpan = Math.max(1, Math.min(Math.ceil(durationMinutes / SLOT_DURATION_MINUTES), totalSlots - slotIndex));
        return { session: s, slotIndex, rowSpan };
      }).filter(Boolean);
    });
    return dayPlacements;
  }, [sessions, displayDays]);

  // Legacy key for first-slot lookup: dayIndex-slotIndex (for free-slot detection)
  const sessionsBySlot = useMemo(() => {
    const map = {};
    sessionPlacementsByDay.forEach((placements, dayIndex) => {
      placements.forEach(({ session, slotIndex }) => {
        const key = `${dayIndex}-${slotIndex}`;
        if (!map[key]) map[key] = [];
        map[key].push(session);
      });
    });
    return map;
  }, [sessionPlacementsByDay]);

  const now = new Date();

  // Derive 12h display values from 24h strings for the time selectors
  const {
    hour: startHour12,
    minute: startMinute,
    ampm: startAmPm,
  } = useMemo(() => parseTime24To12(scheduleTime), [scheduleTime]);

  const {
    hour: endHour12,
    minute: endMinute,
    ampm: endAmPm,
  } = useMemo(() => parseTime24To12(scheduleEndTime), [scheduleEndTime]);
  const upcomingSessions = useMemo(
    () =>
      [...sessions]
        .filter((s) => isAfter(new Date(s.scheduledDate), now))
        .sort(
          (a, b) =>
            new Date(a.scheduledDate) - new Date(b.scheduledDate)
        )
        .slice(0, 10),
    [sessions, now]
  );

  const pastSessions = useMemo(
    () =>
      [...sessions]
        .filter((s) => isBefore(new Date(s.scheduledDate), now))
        .sort(
          (a, b) =>
            new Date(b.scheduledDate) - new Date(a.scheduledDate)
        )
        .slice(0, 10),
    [sessions, now]
  );

  const missedSessions = useMemo(
    () =>
      [...sessions]
        .filter(
          (s) =>
            isBefore(new Date(s.scheduledDate), now) &&
            (
              ['NOT_CONNECTED', 'NO_SHOW_PARENT', 'NO_SHOW_COUNSELOR'].includes(
                s.status
              ) ||
              s.lead?.status === 'CALL_NOT_CONNECTED'
            )
        )
        .sort(
          (a, b) =>
            new Date(b.scheduledDate) - new Date(a.scheduledDate)
        )
        .slice(0, 20),
    [sessions, now]
  );

  // Leads that need status update: meeting time passed OR meeting status is missed (one row per lead, most recent session)
  const leadsRequiringStatusUpdate = useMemo(() => {
    const pastOrMissed = sessions.filter((s) => {
      const passed = isBefore(new Date(s.scheduledDate), now);
      const missed = ['NOT_CONNECTED', 'NO_SHOW_PARENT', 'NO_SHOW_COUNSELOR'].includes(s.status);
      return passed || missed;
    });
    const byLead = new Map();
    pastOrMissed.forEach((s) => {
      const lid = s.lead?.id ?? s.leadId;
      if (!lid) return;
      const existing = byLead.get(lid);
      if (!existing || new Date(s.scheduledDate) > new Date(existing.scheduledDate)) {
        byLead.set(lid, { lead: s.lead || { id: lid, studentName: '—', status: 'NEW' }, session: s });
      }
    });
    return Array.from(byLead.values())
      .sort((a, b) => new Date(b.session.scheduledDate) - new Date(a.session.scheduledDate))
      .slice(0, 20);
  }, [sessions, now]);

  const admissionConfirmationPendingLeads = useMemo(
    () =>
      (leads || []).filter(
        (lead) =>
          lead &&
          lead.status === 'CONTACTED' &&
          lead.classification !== 'ADMISSION_CONFIRMED'
      ),
    [leads]
  );

  const admissionConfirmedLeads = useMemo(
    () =>
      (leads || []).map((lead) => {
        if (!lead) return lead;
        if (lead.admissionPaymentDisplay) return lead;
        const notes = lead.notes || '';
        let admissionPaymentDisplay = null;
        if (/ONLINE/i.test(notes) && /UTR/i.test(notes)) {
          // Try to extract UTR portion after "UTR"
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
      }).filter((lead) => lead?.classification === 'ADMISSION_CONFIRMED'),
    [leads]
  );

  const openAdmissionProofModal = (lead) => {
    setAdmissionProofLead(lead);
    setAdmissionPaymentType('ONLINE');
    setAdmissionPaymentUtr('');
  };

  const closeAdmissionProofModal = () => {
    setAdmissionProofLead(null);
    setAdmissionPaymentType('ONLINE');
    setAdmissionPaymentUtr('');
  };

  const handleSaveAdmissionProof = async () => {
    if (!admissionProofLead?.id) return;
    if (admissionPaymentType === 'ONLINE' && !admissionPaymentUtr.trim()) {
      toast.error('Please enter the UTR / transaction reference number.');
      return;
    }
    setSavingAdmissionProof(true);
    const leadId = admissionProofLead.id;
    const paymentNote =
      admissionPaymentType === 'ONLINE'
        ? `Admission payment recorded by counselor: ONLINE, UTR ${admissionPaymentUtr.trim()}`
        : 'Admission payment recorded by counselor: CASH';
    try {
      await leadAPI.update(leadId, {
        classification: 'ADMISSION_CONFIRMED',
        notes: paymentNote,
      });

      setLeads((prev) =>
        (prev || []).map((l) =>
          l.id === leadId
            ? {
                ...l,
                classification: 'ADMISSION_CONFIRMED',
                admissionPaymentDisplay:
                  admissionPaymentType === 'ONLINE'
                    ? `Online – UTR ${admissionPaymentUtr.trim()}`
                    : 'Cash',
              }
            : l
        )
      );

      setSessions((prev) =>
        prev.map((s) =>
          (s.lead?.id ?? s.leadId) === leadId
            ? {
                ...s,
                lead: s.lead
                  ? {
                      ...s.lead,
                      classification: 'ADMISSION_CONFIRMED',
                    }
                  : s.lead,
              }
            : s
        )
      );

      toast.success('Admission confirmation saved.');
      closeAdmissionProofModal();
    } catch (error) {
      const msg =
        error.response?.data?.message ||
        error.message ||
        'Failed to save admission confirmation';
      toast.error(msg);
    } finally {
      setSavingAdmissionProof(false);
    }
  };

  const handlePrev = () => {
    if (calendarView === 'today') setViewStart((prev) => addDays(prev, -1));
    else if (calendarView === 'week') setViewStart((prev) => addDays(prev, -7));
    else if (calendarView === 'month') setViewStart((prev) => subMonths(prev, 1));
    else if (calendarView === 'custom') {
      const days = differenceInDays(customRangeEnd, customRangeStart) + 1;
      setCustomRangeStart((prev) => addDays(prev, -days));
      setCustomRangeEnd((prev) => addDays(prev, -days));
    }
  };

  const handleNext = () => {
    if (calendarView === 'today') setViewStart((prev) => addDays(prev, 1));
    else if (calendarView === 'week') setViewStart((prev) => addDays(prev, 7));
    else if (calendarView === 'month') setViewStart((prev) => addMonths(prev, 1));
    else if (calendarView === 'custom') {
      const days = differenceInDays(customRangeEnd, customRangeStart) + 1;
      setCustomRangeStart((prev) => addDays(prev, days));
      setCustomRangeEnd((prev) => addDays(prev, days));
    }
  };

  const handleToday = () => {
    const today = new Date();
    if (calendarView === 'today') setViewStart(startOfDay(today));
    else if (calendarView === 'week') setViewStart(startOfWeek(today, { weekStartsOn: 1 }));
    else if (calendarView === 'month') setViewStart(startOfMonth(today));
    else if (calendarView === 'custom') {
      setCustomRangeStart(startOfDay(today));
      setCustomRangeEnd(endOfDay(today));
    }
  };

  const handleJoinSession = (session) => {
    if (session.meetingType === 'AUDIO') return;
    const link = session.meeting_link || session.meetingLink;
    if (!link) {
      toast.error('No meeting link set for this session.');
      return;
    }
    window.open(link, '_blank', 'noopener,noreferrer');
  };

  const isAudioSession = (session) => session.meetingType === 'AUDIO';

  const getLeadContactNumber = (session) =>
    session.lead?.parentMobile || session.lead?.parentPhone || session.lead?.phone || null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Counseling Sessions
          </h1>
          <p className="text-slate-600 mt-1">
            Manage and schedule 30-minute counseling sessions.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              const today = new Date();
              const firstSlot = new Date();
              firstSlot.setHours(DAY_START_HOUR, 0, 0, 0);
              if (isBefore(today, firstSlot)) {
                openScheduleModal(firstSlot);
              } else {
                const minutesSinceStart =
                  today.getHours() * 60 +
                  today.getMinutes() -
                  DAY_START_HOUR * 60;
                const slotsSinceStart = Math.ceil(
                  Math.max(0, minutesSinceStart) / SLOT_DURATION_MINUTES
                );
                const slotStart = addMinutes(
                  startOfDay(today),
                  DAY_START_HOUR * 60 + slotsSinceStart * SLOT_DURATION_MINUTES
                );
                openScheduleModal(slotStart);
              }
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 text-white font-medium hover:bg-primary-700 shadow-sm"
          >
            <span className="text-lg">+</span>
            Schedule Session
          </button>
          <button
            type="button"
            onClick={handleToday}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
          >
            Today
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,3fr)_minmax(0,1.4fr)] gap-6">
        {/* Left: calendar */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-soft overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrev}
                className="px-2 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                aria-label="Previous"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="px-2 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                aria-label="Next"
              >
                ›
              </button>
              <span className="ml-2 font-semibold text-slate-800">
                {calendarView === 'today'
                  ? format(viewStart, 'EEEE, MMM d, yyyy')
                  : calendarView === 'week'
                    ? `Week of ${format(startOfWeek(viewStart, { weekStartsOn: 1 }), 'MMM d, yyyy')}`
                    : calendarView === 'custom'
                      ? `${format(customRangeStart, 'MMM d')} – ${format(customRangeEnd, 'MMM d, yyyy')}`
                      : format(viewStart, 'MMMM yyyy')}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {calendarView === 'custom' && (
                <>
                  <label className="flex items-center gap-1.5 text-xs text-slate-600">
                    <span>From</span>
                    <input
                      type="date"
                      value={format(customRangeStart, 'yyyy-MM-dd')}
                      onChange={(e) => {
                        const d = new Date(e.target.value);
                        if (!isNaN(d.getTime())) {
                          setCustomRangeStart(startOfDay(d));
                          if (d > customRangeEnd) setCustomRangeEnd(endOfDay(d));
                        }
                      }}
                      className="text-xs px-2 py-1 rounded border border-slate-200"
                    />
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-600">
                    <span>To</span>
                    <input
                      type="date"
                      value={format(customRangeEnd, 'yyyy-MM-dd')}
                      onChange={(e) => {
                        const d = new Date(e.target.value);
                        if (!isNaN(d.getTime())) {
                          setCustomRangeEnd(endOfDay(d));
                          if (d < customRangeStart) setCustomRangeStart(startOfDay(d));
                        }
                      }}
                      className="text-xs px-2 py-1 rounded border border-slate-200"
                    />
                  </label>
                </>
              )}
              <p className="hidden sm:block text-xs text-slate-500">
                View
              </p>
              <select
                value={calendarView}
                onChange={(e) => {
                  const value = e.target.value;
                  const today = new Date();
                  setCalendarView(value);
                  if (value === 'today') setViewStart(startOfDay(today));
                  else if (value === 'week') setViewStart(startOfWeek(viewStart, { weekStartsOn: 1 }));
                  else if (value === 'month') setViewStart(startOfMonth(viewStart));
                  else if (value === 'custom') {
                    setCustomRangeStart(startOfWeek(today, { weekStartsOn: 1 }));
                    setCustomRangeEnd(endOfDay(addDays(startOfWeek(today, { weekStartsOn: 1 }), 6)));
                  }
                }}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 cursor-pointer"
              >
                <option value="today">Today</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
                <option value="custom">Custom Date Range</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr>
                  <th className="w-20 border-b border-slate-200 bg-slate-50" />
                  {displayDays.map((day) => (
                    <th
                      key={day.toISOString()}
                      className="border-b border-slate-200 bg-slate-50 px-2 py-2 text-xs font-semibold text-slate-700 text-center min-w-[100px]"
                    >
                      <div>{format(day, 'EEE')}</div>
                      <div className="text-slate-500">
                        {format(day, 'MMM d')}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIME_SLOTS.map((slot, slotIndex) => (
                    <tr key={`${slot.startHour}-${slot.startMinute}`}>
                      <td className="border-t border-slate-100 px-2 py-3 text-[11px] text-slate-500 align-top w-16 text-right pr-3">
                        {slot.startMinute === 0
                          ? format(
                              new Date().setHours(slot.startHour, 0, 0, 0),
                              'h a'
                            )
                          : ''}
                      </td>
                      {displayDays.map((day, dayIndex) => {
                        const placements = sessionPlacementsByDay[dayIndex] || [];
                        const placement = placements.find((p) => p.slotIndex === slotIndex);
                        const slotDate = new Date(
                          day.getFullYear(),
                          day.getMonth(),
                          day.getDate(),
                          slot.startHour,
                          slot.startMinute,
                          0,
                          0
                        );
                        const isPast = isBefore(slotDate, now);
                        const key = `${dayIndex}-${slotIndex}`;

                        if (placement) {
                          const { session, rowSpan } = placement;
                          return (
                            <td
                              key={key}
                              rowSpan={rowSpan}
                              className="border-t border-slate-100 px-0.5 py-0.5 align-top vertical-align-top"
                            >
                              <div
                                className="flex flex-col gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] text-slate-800 shadow-[0_1px_0_rgba(244,63,94,0.2)] h-full min-h-[2.5rem]"
                                title="Busy – click for session details"
                              >
                                <div className="font-semibold truncate">
                                  {session.lead?.studentName ||
                                    session.lead?.parentName ||
                                    'Student'}
                                </div>
                                <div className="text-[11px] text-rose-700">
                                  {getSessionTimeRange(session)} ·{' '}
                                  {getSessionMeetingLabel(session)}
                                </div>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {isAudioSession(session) ? (
                                    getLeadContactNumber(session) ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] text-slate-700 font-medium">
                                        <Phone className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                                        {getLeadContactNumber(session)}
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 text-[11px] text-slate-500">
                                        No contact number
                                      </span>
                                    )
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleJoinSession(session)}
                                      className="px-2 py-0.5 rounded-lg bg-rose-600 text-white text-[11px] hover:bg-rose-700"
                                    >
                                      Join Meet
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openScheduleModal(slotDate, session)
                                    }
                                    className="px-2 py-0.5 rounded-lg border border-rose-300 text-rose-800 text-[11px] bg-white hover:bg-rose-50"
                                  >
                                    Reschedule
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleCancelSession(session)}
                                    className="px-2 py-0.5 rounded-lg border border-red-200 text-red-600 text-[11px] bg-white hover:bg-red-50"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            </td>
                          );
                        }
                        const coveredByAbove = placements.some(
                          (p) => p.slotIndex < slotIndex && p.slotIndex + p.rowSpan > slotIndex
                        );
                        if (coveredByAbove)
                          return <td key={key} className="border-t border-slate-100 p-0 align-top bg-slate-50/30 min-w-[100px]" />;

                        return (
                          <td
                            key={key}
                            className="border-t border-slate-100 px-0.5 py-0.5 align-top min-w-[100px]"
                          >
                            <button
                              type="button"
                              disabled={isPast}
                              onClick={() => openScheduleModal(slotDate)}
                              className={`w-full h-10 rounded-md border border-emerald-200/60 text-[10px] flex items-center justify-center bg-emerald-50/80 hover:bg-emerald-100/80 transition-colors ${
                                isPast
                                  ? 'bg-slate-50 border-slate-100 cursor-not-allowed text-slate-400'
                                  : 'text-emerald-700'
                              }`}
                              title={
                                isPast
                                  ? 'Cannot schedule in the past'
                                  : 'Free slot – click to schedule a session'
                              }
                            >
                              {!isPast && (
                                <span>+ Schedule</span>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                ))}
              </tbody>
            </table>
            {loading && (
              <div className="px-4 py-2 text-xs text-slate-500">
                Loading sessions...
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-soft p-4">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">
              Upcoming Sessions
            </h2>
            {upcomingSessions.length === 0 ? (
              <p className="text-xs text-slate-500">
                No upcoming sessions scheduled.
              </p>
            ) : (
              <ul className="space-y-2 max-h-64 overflow-y-auto">
                {upcomingSessions.map((s) => (
                  <li
                    key={s.id}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs flex flex-col gap-0.5"
                  >
                    <div className="flex justify-between gap-2">
                      <span className="font-medium text-slate-900 truncate">
                        {s.lead?.studentName ||
                          s.lead?.parentName ||
                          'Student'}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {format(new Date(s.scheduledDate), 'MMM d')}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2 text-[11px] text-slate-600">
                      <span>
                        {getSessionTimeRange(s)} ·{' '}
                        {getSessionMeetingLabel(s)}
                      </span>
                      <span>{s.status || 'SCHEDULED'}</span>
                    </div>
                    <div className="flex gap-1 mt-1">
                      {isAudioSession(s) ? (
                        getLeadContactNumber(s) ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] text-slate-700 font-medium">
                            <Phone className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                            {getLeadContactNumber(s)}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[11px] text-slate-500">
                            No contact number
                          </span>
                        )
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleJoinSession(s)}
                          className="px-2 py-0.5 rounded-lg bg-emerald-600 text-white text-[11px] hover:bg-emerald-700"
                        >
                          Join Meet
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          openScheduleModal(new Date(s.scheduledDate), s)
                        }
                        className="px-2 py-0.5 rounded-lg border border-slate-200 text-slate-700 text-[11px] bg-white hover:bg-slate-50"
                      >
                        Reschedule
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-soft p-4">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">
              Recent Sessions
            </h2>
            {pastSessions.length === 0 ? (
              <p className="text-xs text-slate-500">
                No recent sessions in this range.
              </p>
            ) : (
              <ul className="space-y-2 max-h-64 overflow-y-auto">
                {pastSessions.map((s) => (
                  <li
                    key={s.id}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs flex flex-col gap-0.5"
                  >
                    <div className="flex justify-between gap-2">
                      <span className="font-medium text-slate-900 truncate">
                        {s.lead?.studentName ||
                          s.lead?.parentName ||
                          'Student'}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {format(new Date(s.scheduledDate), 'MMM d')}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2 text-[11px] text-slate-600">
                      <span>
                        {getSessionTimeRange(s)} ·{' '}
                        {getSessionMeetingLabel(s)}
                      </span>
                      <span>{s.status || 'COMPLETED'}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-soft p-4">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">
              Missed Calls
            </h2>
            {missedSessions.length === 0 ? (
              <p className="text-xs text-slate-500">
                No missed calls in this range.
              </p>
            ) : (
              <ul className="space-y-3 max-h-[420px] overflow-y-auto">
                {missedSessions.map((s) => {
                  const { type: reasonType, customText } = getMissedReasonForSession(s);
                  const isSaving = savingMissedSessionId === s.id;
                  return (
                    <li
                      key={s.id}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-xs flex flex-col gap-1.5"
                    >
                      <div className="flex justify-between gap-2">
                        <span className="font-medium text-slate-900 truncate">
                          {s.lead?.studentName ||
                            s.lead?.parentName ||
                            'Student'}
                        </span>
                        <span className="text-[11px] text-slate-500 shrink-0">
                          {format(new Date(s.scheduledDate), 'MMM d')}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600">
                        {getSessionTimeRange(s)} ·{' '}
                        <span className="font-medium text-amber-700">
                          {getSessionMeetingLabel(s)} missed
                        </span>
                      </div>
                      <div className="mt-0.5">
                        <label className="block text-[11px] text-slate-500 mb-0.5">
                          Who missed / reason
                        </label>
                        <select
                          value={reasonType}
                          onChange={(e) => {
                            const v = e.target.value;
                            setDraftMissedReasons((prev) => ({
                              ...prev,
                              [s.id]: {
                                type: v,
                                customText: v === 'CUSTOM' ? (prev[s.id]?.customText ?? s.connectionReason ?? '') : '',
                              },
                            }));
                          }}
                          className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] bg-white"
                        >
                          <option value="">Select reason</option>
                          <option value="COUNSELOR_MISSED">Counselor missed</option>
                          <option value="PARENT_MISSED">Parent missed</option>
                          <option value="CUSTOM">Custom reason</option>
                        </select>
                        {reasonType === 'CUSTOM' && (
                          <input
                            type="text"
                            value={customText}
                            onChange={(e) =>
                              setDraftMissedReasons((prev) => ({
                                ...prev,
                                [s.id]: { type: 'CUSTOM', customText: e.target.value },
                              }))
                            }
                            placeholder="Enter custom reason"
                            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-[11px]"
                          />
                        )}
                        <button
                          type="button"
                          disabled={isSaving || !reasonType}
                          onClick={() => handleSaveMissedReason(s)}
                          className="mt-1.5 px-2 py-1 rounded-lg bg-slate-800 text-white text-[11px] hover:bg-slate-700 disabled:opacity-50 disabled:pointer-events-none"
                        >
                          {isSaving ? 'Saving…' : 'Save reason'}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-soft p-4">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">
              Leads Requiring Status Update
            </h2>
            {leadsRequiringStatusUpdate.length === 0 ? (
              <p className="text-xs text-slate-500">
                No leads requiring status update in this range.
              </p>
            ) : (
              <ul className="space-y-3 max-h-[420px] overflow-y-auto">
                {leadsRequiringStatusUpdate.map(({ lead, session }) => {
                  const leadId = lead?.id;
                  const isSaving = savingLeadStatusId === leadId;
                  const currentStatus = lead?.status || 'NEW';
                  const displayStatus = currentStatus.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
                  const showFollowUpScheduled = leadStatusFollowUpScheduled.has(leadId);
                  const selectedValue = showFollowUpScheduled ? 'FOLLOW_UP_SCHEDULED' : currentStatus;
                  return (
                    <li
                      key={leadId}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-xs flex flex-col gap-1.5"
                    >
                      <div className="flex justify-between gap-2">
                        <span className="font-medium text-slate-900 truncate">
                          {lead?.studentName || lead?.parentName || 'Student'}
                        </span>
                        <span className="text-[11px] text-slate-500 shrink-0">
                          {format(new Date(session.scheduledDate), 'MMM d, h:mm a')}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600">
                        Current status: <span className="font-medium">{displayStatus}</span>
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-0.5">
                          Update Status
                        </label>
                        <select
                          value={selectedValue}
                          onChange={(e) => {
                            const v = e.target.value;
                            handleLeadStatusUpdate(leadId, v);
                          }}
                          disabled={isSaving}
                          className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] bg-white"
                        >
                          {LEAD_STATUS_UPDATE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        {selectedValue === 'FOLLOW_UP' ? (
                          <button
                            type="button"
                            onClick={() => openScheduleModalForLead(lead, true)}
                            className="mt-1.5 w-full px-2 py-1 rounded-lg bg-emerald-600 text-white text-[11px] hover:bg-emerald-700"
                          >
                            Schedule follow-up meeting
                          </button>
                        ) : null}
                        {selectedValue === 'CALL_NOT_CONNECTED' ? (
                          <div className="mt-1.5 flex gap-1 flex-wrap">
                            <button
                              type="button"
                              onClick={() => openScheduleModal(new Date(session.scheduledDate), session)}
                              className="px-2 py-1 rounded-lg border border-slate-200 text-slate-700 text-[11px] bg-white hover:bg-slate-50"
                            >
                              Reschedule Meeting
                            </button>
                            {lead?.parentMobile ? (
                              <a
                                href={`tel:${lead.parentMobile}`}
                                className="px-2 py-1 rounded-lg bg-slate-800 text-white text-[11px] hover:bg-slate-700 inline-flex items-center gap-1"
                              >
                                <Phone className="w-3 h-3" />
                                Call Student
                              </a>
                            ) : (
                              <span className="px-2 py-1 text-[11px] text-slate-500">No phone number</span>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-soft p-4">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">
              Admission Confirmation Pending
            </h2>
            {admissionConfirmationPendingLeads.length === 0 ? (
              <p className="text-xs text-slate-500">
                No leads are currently pending admission confirmation.
              </p>
            ) : (
              <ul className="space-y-3 max-h-[320px] overflow-y-auto">
                {admissionConfirmationPendingLeads.map((lead) => (
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
                    <div className="text-[11px] text-slate-600">
                      Status:{' '}
                      <span className="font-medium">
                        Contacted &amp; Interested (Ready to take admission)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => openAdmissionProofModal(lead)}
                      className="mt-1.5 w-full px-2 py-1 rounded-lg bg-emerald-600 text-white text-[11px] hover:bg-emerald-700"
                    >
                      Attach Admission Proof
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-soft p-4">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">
              Admission Confirmed
            </h2>
            {admissionConfirmedLeads.length === 0 ? (
              <p className="text-xs text-slate-500">
                No students have been marked as admission confirmed yet.
              </p>
            ) : (
              <ul className="space-y-3 max-h-[320px] overflow-y-auto">
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
                    <div className="text-[11px] text-slate-600">
                      Status:{' '}
                      <span className="font-medium text-emerald-700">
                        Admission Confirmed
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Payment:{' '}
                      <span className="font-medium">
                        {lead.admissionPaymentDisplay || 'Recorded in lead notes'}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Schedule / Reschedule Modal */}
      {scheduleModalOpen && selectedSlot && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full p-6">
            {/* Top mode toggle: Face-to-face vs Online */}
            <div className="flex mb-4 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden text-sm">
              <button
                type="button"
                onClick={() => setMeetingMode('FACE_TO_FACE')}
                className={`flex-1 px-4 py-2 font-medium border-r border-slate-200 ${
                  meetingMode === 'FACE_TO_FACE'
                    ? 'bg-white text-slate-900'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                Face to Face Meeting
              </button>
              <button
                type="button"
                onClick={() => setMeetingMode('ONLINE')}
                className={`flex-1 px-4 py-2 font-medium ${
                  meetingMode === 'ONLINE'
                    ? 'bg-white text-slate-900'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                Online Meeting
              </button>
            </div>

            {/* Online meeting sub-toggle: Audio vs Video */}
            {meetingMode === 'ONLINE' && (
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-medium text-slate-700">
                  Meeting Mode
                </span>
                <div className="inline-flex rounded-full bg-slate-100 p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setOnlineMode('audio')}
                    className={`px-4 py-1 rounded-full flex items-center gap-1 transition-colors ${
                      onlineMode === 'audio'
                        ? 'bg-blue-500 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span className="inline-block w-3 h-3 border border-current rounded-full" />
                    Audio
                  </button>
                  <button
                    type="button"
                    onClick={() => setOnlineMode('video')}
                    className={`px-4 py-1 rounded-full flex items-center gap-1 transition-colors ${
                      onlineMode === 'video'
                        ? 'bg-blue-500 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span className="inline-block w-3 h-3 border border-current rounded-sm" />
                    Video
                  </button>
                </div>
              </div>
            )}

            <h2 className="text-lg font-semibold text-slate-900 mb-1">
              {editingSession ? 'Reschedule Counseling Session' : 'Create Counseling Session'}
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Choose any start and end time for the counseling session (calendar grid still shows 30-minute rows).
            </p>
            <form onSubmit={handleSaveSession} className="space-y-4">
              {!editingSession && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Assign to (student / lead)
                  </label>
                  <select
                    value={selectedLeadId}
                    onChange={(e) => setSelectedLeadId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    disabled={leadsLoading}
                    required
                  >
                    <option value="">
                      {leadsLoading
                        ? 'Loading your leads...'
                        : 'Select a lead'}
                    </option>
                    {leads.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.studentName || l.parentName} ({l.leadId})
                      </option>
                    ))}
                  </select>
                  {!leadsLoading && leads.length === 0 && (
                    <p className="mt-1 text-[11px] text-amber-600">
                      No leads assigned yet. Ask admin to assign leads to you.
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)] gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => {
                      setScheduleDate(e.target.value);
                      setSelectedSlot(
                        new Date(`${e.target.value}T${scheduleTime}:00`)
                      );
                    }}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    India Standard Time (Asia/Kolkata)
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Time
                  </label>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-[11px] text-slate-500">Duration preset:</span>
                    {[15, 30, 45, 60].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => {
                          const start = new Date(`${scheduleDate}T${scheduleTime}:00`);
                          if (isNaN(start.getTime())) return;
                          const endDate = addMinutes(start, mins);
                          setScheduleEndTime(format(endDate, 'HH:mm'));
                          setDurationPreset(mins);
                        }}
                        className={`px-2 py-0.5 rounded text-xs border ${
                          durationPreset === mins
                            ? 'bg-primary-100 border-primary-300 text-primary-800'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {mins} min
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {/* Start time: 12-hour clock */}
                    <div className="flex items-center gap-1 w-full sm:flex-1">
                      <select
                        value={startHour12}
                        onChange={(e) => {
                          setDurationPreset(null);
                          const newTime = to24HourString(
                            e.target.value,
                            startMinute,
                            startAmPm
                          );
                          setScheduleTime(newTime);
                          setSelectedSlot(
                            new Date(`${scheduleDate}T${newTime}:00`)
                          );
                        }}
                        className="w-16 rounded-lg border border-slate-200 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        {Array.from({ length: 12 }, (_, i) => String(i + 1)).map(
                          (h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          )
                        )}
                      </select>
                      <span className="text-sm text-slate-500">:</span>
                      <select
                        value={startMinute}
                        onChange={(e) => {
                          setDurationPreset(null);
                          const newTime = to24HourString(
                            startHour12,
                            e.target.value,
                            startAmPm
                          );
                          setScheduleTime(newTime);
                          setSelectedSlot(
                            new Date(`${scheduleDate}T${newTime}:00`)
                          );
                        }}
                        className="w-16 rounded-lg border border-slate-200 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        {Array.from({ length: 60 }, (_, i) =>
                          String(i).padStart(2, '0')
                        ).map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                      <select
                        value={startAmPm}
                        onChange={(e) => {
                          setDurationPreset(null);
                          const newTime = to24HourString(
                            startHour12,
                            startMinute,
                            e.target.value
                          );
                          setScheduleTime(newTime);
                          setSelectedSlot(
                            new Date(`${scheduleDate}T${newTime}:00`)
                          );
                        }}
                        className="w-16 rounded-lg border border-slate-200 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                    </div>
                    <span className="text-[11px] text-slate-500">to</span>
                    {/* End time: 12-hour clock */}
                    <div className="flex items-center gap-1 w-full sm:flex-1">
                      <select
                        value={endHour12}
                        onChange={(e) => {
                          setDurationPreset(null);
                          const newTime = to24HourString(
                            e.target.value,
                            endMinute,
                            endAmPm
                          );
                          setScheduleEndTime(newTime);
                        }}
                        className="w-16 rounded-lg border border-slate-200 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        {Array.from({ length: 12 }, (_, i) => String(i + 1)).map(
                          (h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          )
                        )}
                      </select>
                      <span className="text-sm text-slate-500">:</span>
                      <select
                        value={endMinute}
                        onChange={(e) => {
                          setDurationPreset(null);
                          const newTime = to24HourString(
                            endHour12,
                            e.target.value,
                            endAmPm
                          );
                          setScheduleEndTime(newTime);
                        }}
                        className="w-16 rounded-lg border border-slate-200 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        {Array.from({ length: 60 }, (_, i) =>
                          String(i).padStart(2, '0')
                        ).map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                      <select
                        value={endAmPm}
                        onChange={(e) => {
                          setDurationPreset(null);
                          const newTime = to24HourString(
                            endHour12,
                            endMinute,
                            e.target.value
                          );
                          setScheduleEndTime(newTime);
                        }}
                        className="w-16 rounded-lg border border-slate-200 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                    </div>
                  </div>
                  {hasBusyOverlap && (
                    <p className="mt-1.5 text-xs text-rose-600 font-medium">
                      This time slot is already busy.
                    </p>
                  )}
                </div>
              </div>

              {/* Quick view of free/busy slots for the selected date */}
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-medium text-slate-700">
                    Availability for {format(new Date(scheduleDate), 'MMM d, yyyy')}
                  </span>
                  <span className="text-[10px] text-slate-500 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" /> Free
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-rose-500" /> Busy
                    </span>
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                  {availabilityForSelectedDate.map((range, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        if (range.busy) return;
                        const start24 = format(range.start, 'HH:mm');
                        const end24 = format(range.end, 'HH:mm');
                        setScheduleTime(start24);
                        setScheduleEndTime(end24);
                        setSelectedSlot(new Date(`${scheduleDate}T${start24}:00`));
                      }}
                      className={`px-2 py-0.5 rounded-full text-[10px] border transition-colors ${
                        range.busy
                          ? 'bg-rose-50 border-rose-100 text-rose-500 cursor-not-allowed'
                          : 'bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100'
                      }`}
                    >
                      {`${format(range.start, 'h:mm a')} – ${format(
                        range.end,
                        'h:mm a'
                      )}`}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Agenda / Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="What will you discuss in this counseling session?"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeScheduleModal}
                  className="flex-1 inline-flex items-center justify-center px-3 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || hasBusyOverlap}
                  className="flex-1 inline-flex items-center justify-center px-3 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-60"
                >
                  {saving
                    ? editingSession
                      ? 'Rescheduling...'
                      : 'Scheduling...'
                    : editingSession
                    ? 'Save changes'
                    : 'Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {admissionProofLead && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">
              Attach Admission Proof
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Record how the admission fee was paid for{' '}
              <span className="font-medium">
                {admissionProofLead.studentName ||
                  admissionProofLead.parentName ||
                  'Student'}
              </span>
              . After saving, this lead will move to Admission Confirmed.
            </p>

            <div className="space-y-4">
              <div>
                <span className="block text-xs font-medium text-slate-700 mb-1">
                  Payment Method
                </span>
                <div className="inline-flex rounded-full bg-slate-100 p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setAdmissionPaymentType('ONLINE')}
                    className={`px-4 py-1 rounded-full transition-colors ${
                      admissionPaymentType === 'ONLINE'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    Online Payment
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdmissionPaymentType('CASH')}
                    className={`px-4 py-1 rounded-full transition-colors ${
                      admissionPaymentType === 'CASH'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    Cash
                  </button>
                </div>
              </div>

              {admissionPaymentType === 'ONLINE' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    UTR / Transaction Reference Number
                  </label>
                  <input
                    type="text"
                    value={admissionPaymentUtr}
                    onChange={(e) => setAdmissionPaymentUtr(e.target.value)}
                    placeholder="Enter UTR / transaction ID"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    This helps finance verify the payment later.
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeAdmissionProofModal}
                  className="flex-1 inline-flex items-center justify-center px-3 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingAdmissionProof}
                  onClick={handleSaveAdmissionProof}
                  className="flex-1 inline-flex items-center justify-center px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
                >
                  {savingAdmissionProof ? 'Saving...' : 'Save & Confirm Admission'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CounselorSessions;

