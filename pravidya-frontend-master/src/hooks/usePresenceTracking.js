import { useState, useEffect, useCallback } from 'react';
import { presenceAPI } from '../services/api';
import toast from 'react-hot-toast';

/**
 * Custom hook for presence tracking
 * Handles idle detection and activity updates
 */
export const usePresenceTracking = (counselorId) => {
  const [presence, setPresence] = useState({
    status: 'OFFLINE',
    lastLoginAt: null,
    activeMinutesToday: 0,
    totalActiveMinutes: 0
  });
  const [isTracking, setIsTracking] = useState(false);

  // Record login
  const recordLogin = useCallback(async () => {
    try {
      const response = await presenceAPI.recordLogin();
      const data = response.data?.data;
      if (data) {
        setPresence((prev) => ({ ...prev, ...data }));
      }
      setIsTracking(true);
    } catch (error) {
      console.error('Failed to record login:', error);
    }
  }, []);

  // Update activity
  const updateActivity = useCallback(async () => {
    if (!isTracking) return;
    
    try {
      await presenceAPI.updateActivity();
      // Refresh status
      const statusResponse = await presenceAPI.getStatus(counselorId);
      setPresence(statusResponse.data.data);
    } catch (error) {
      console.error('Failed to update activity:', error);
    }
  }, [counselorId, isTracking]);

  // Get current status (merge so clockInAt, breakReason etc. from API are kept)
  const refreshStatus = useCallback(async () => {
    try {
      const response = await presenceAPI.getStatus(counselorId);
      const data = response.data?.data;
      if (data) {
        setPresence((prev) => ({ ...prev, ...data }));
      }
    } catch (error) {
      console.error('Failed to get status:', error);
    }
  }, [counselorId]);

  // Idle detection
  useEffect(() => {
    if (!isTracking) return;

    let idleTimer;
    let activityTimer;
    const IDLE_THRESHOLD = 15 * 60 * 1000; // 15 minutes
    const OFFLINE_THRESHOLD = 30 * 60 * 1000; // 30 minutes
    let lastActivity = Date.now();

    // Activity events
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    const handleActivity = () => {
      lastActivity = Date.now();
      updateActivity();
      
      // Clear existing timers
      clearTimeout(idleTimer);
      clearTimeout(activityTimer);
      
      // Set new timers
      idleTimer = setTimeout(() => {
        // Mark as AWAY after 15 minutes
        refreshStatus();
      }, IDLE_THRESHOLD);

      activityTimer = setTimeout(() => {
        // Mark as OFFLINE after 30 minutes
        refreshStatus();
      }, OFFLINE_THRESHOLD);
    };

    // Attach event listeners
    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Initial timers
    idleTimer = setTimeout(() => refreshStatus(), IDLE_THRESHOLD);
    activityTimer = setTimeout(() => refreshStatus(), OFFLINE_THRESHOLD);

    // Periodic status refresh (every 5 minutes)
    const statusInterval = setInterval(() => {
      refreshStatus();
    }, 5 * 60 * 1000);

    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      clearTimeout(idleTimer);
      clearTimeout(activityTimer);
      clearInterval(statusInterval);
    };
  }, [isTracking, updateActivity, refreshStatus]);

  // Initial load
  useEffect(() => {
    if (counselorId) {
      refreshStatus();
    }
  }, [counselorId, refreshStatus]);

  return {
    presence,
    isTracking,
    recordLogin,
    updateActivity,
    refreshStatus
  };
};
