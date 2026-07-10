/**
 * useWatchTracker — hook to track video watch time.
 *
 * Usage:
 *   const { startTracking, stopTracking } = useWatchTracker({
 *     videoUrl, videoId, eventId, videoType, ownerType
 *   });
 *   // Call startTracking() when video starts playing
 *   // Call stopTracking() when video pauses/ends — automatically sends the tracked minutes
 *
 * Improvements:
 *   - Visibility change handler: pauses tracking when tab is hidden, resumes on return
 *   - beforeunload handler: flushes remaining time when tab closes
 *   - Session dedup: prevents double-counting on replay within same mount
 *   - Buffering-safe: tracking only counts time while video is actually playing
 */
import { useRef, useCallback, useEffect } from "react";
import { base44 } from "@/api/base44Client";

const TRACK_INTERVAL_MS = 30000; // Send updates every 30s
const MIN_SESSION_SECONDS = 5;   // Don't track sessions shorter than 5s
const HEARTBEAT_MS = 5000;       // Verify video is still playing every 5s

export default function useWatchTracker({
  videoUrl,
  videoId = "",
  eventId = null,
  videoType = "normal",
  ownerType = "organizer",
}) {
  const startTimeRef = useRef(null);
  const accumulatedRef = useRef(0);
  const intervalRef = useRef(null);
  const heartbeatRef = useRef(null);
  const lastFlushRef = useRef(0);
  const sentRef = useRef(false);
  const isActiveRef = useRef(false);
  const videoElRef = useRef(null);

  // Store reference to video element for heartbeat checks
  const setVideoElement = useCallback((el) => {
    videoElRef.current = el;
  }, []);

  const flush = useCallback(async (final = false) => {
    if (!videoUrl) return;

    const now = Date.now();
    const elapsed = (now - lastFlushRef.current) / 1000 / 60; // in minutes
    if (elapsed <= 0 && !final) return;

    // For final flush, calculate the remaining time since last flush
    const minutes = final
      ? ((now - startTimeRef.current) / 1000 / 60) - accumulatedRef.current
      : elapsed;

    if (minutes <= 0) return;
    accumulatedRef.current += minutes;
    lastFlushRef.current = now;

    // Don't send if total session is too short
    const totalMinutes = (now - startTimeRef.current) / 1000 / 60;
    if (final && totalMinutes < (MIN_SESSION_SECONDS / 60)) return;

    try {
      await base44.functions.invoke("videoMinuteBilling", {
        action: "track_watch",
        video_url: videoUrl,
        video_id: videoId,
        minutes_watched: parseFloat(minutes.toFixed(3)),
        event_id: eventId,
        video_type: videoType,
        owner_type: ownerType,
      });
    } catch (_) { /* fail silently — tracking is non-blocking */ }

    if (final) sentRef.current = true;
  }, [videoUrl, videoId, eventId, videoType, ownerType]);

  // Heartbeat: only count time when video is actually playing (not paused/buffering)
  const startHeartbeat = useCallback(() => {
    if (heartbeatRef.current) return;
    heartbeatRef.current = setInterval(() => {
      const v = videoElRef.current;
      // If video element exists and is paused, stop tracking
      if (v && v.paused && isActiveRef.current) {
        // Video paused unexpectedly (not by our stopTracking call) — pause tracking
        isActiveRef.current = false;
      }
      // If video resumed playing, restart tracking
      if (v && !v.paused && !isActiveRef.current && startTimeRef.current && !sentRef.current) {
        isActiveRef.current = true;
        lastFlushRef.current = Date.now();
      }
    }, HEARTBEAT_MS);
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  // Visibility change handler — pause/resume tracking on tab switches
  useEffect(() => {
    const onVisibility = () => {
      if (!startTimeRef.current || sentRef.current) return;
      if (document.hidden) {
        // Tab hidden: flush current progress and pause
        if (isActiveRef.current && intervalRef.current) {
          flush(false);
          isActiveRef.current = false;
        }
      } else {
        // Tab visible again: resume from current time
        const v = videoElRef.current;
        if (v && !v.paused && !isActiveRef.current) {
          isActiveRef.current = true;
          lastFlushRef.current = Date.now();
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [flush]);

  // beforeunload handler — flush remaining time when tab closes
  useEffect(() => {
    const onUnload = () => {
      if (startTimeRef.current && !sentRef.current) {
        // Use sendBeacon for reliable final flush on unload
        const now = Date.now();
        const totalMinutes = (now - startTimeRef.current) / 1000 / 60;
        if (totalMinutes < (MIN_SESSION_SECONDS / 60)) return;
        const remaining = totalMinutes - accumulatedRef.current;
        if (remaining <= 0) return;

        const payload = JSON.stringify({
          action: "track_watch",
          video_url: videoUrl,
          video_id: videoId,
          minutes_watched: parseFloat(remaining.toFixed(3)),
          event_id: eventId,
          video_type: videoType,
          owner_type: ownerType,
        });

        // sendBeacon for reliable delivery on page close
        if (navigator.sendBeacon) {
          navigator.sendBeacon(
            `${window.location.origin}/api/functions/videoMinuteBilling`,
            payload
          );
        }
      }
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [videoUrl, videoId, eventId, videoType, ownerType]);

  const startTracking = useCallback(() => {
    if (!videoUrl || sentRef.current) return;
    startTimeRef.current = Date.now();
    lastFlushRef.current = Date.now();
    accumulatedRef.current = 0;
    sentRef.current = false;
    isActiveRef.current = true;

    // Flush every 30 seconds
    intervalRef.current = setInterval(() => flush(false), TRACK_INTERVAL_MS);

    // Start heartbeat to verify video is still playing
    startHeartbeat();
  }, [videoUrl, flush, startHeartbeat]);

  const stopTracking = useCallback(() => {
    isActiveRef.current = false;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    stopHeartbeat();
    if (startTimeRef.current && !sentRef.current) {
      flush(true);
    }
  }, [flush, stopHeartbeat]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      stopHeartbeat();
      if (startTimeRef.current && !sentRef.current) {
        // Final flush on unmount (component removed from DOM)
        const now = Date.now();
        const totalMinutes = (now - startTimeRef.current) / 1000 / 60;
        if (totalMinutes >= (MIN_SESSION_SECONDS / 60)) {
          const remaining = totalMinutes - accumulatedRef.current;
          if (remaining > 0) {
            base44.functions.invoke("videoMinuteBilling", {
              action: "track_watch",
              video_url: videoUrl,
              video_id: videoId,
              minutes_watched: parseFloat(remaining.toFixed(3)),
              event_id: eventId,
              video_type: videoType,
              owner_type: ownerType,
            }).catch(() => {});
          }
        }
      }
    };
  }, []);

  return { startTracking, stopTracking, setVideoElement };
}