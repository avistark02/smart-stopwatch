import { useState, useEffect, useRef, useCallback } from 'react';
import * as faceapi from 'face-api.js';

/** Grace period (ms) before going idle/error after losing the matched face.
 *  Prevents presence flickering that causes timer jumps. */
const PRESENCE_GRACE_MS = 2000;

/** Euclidean distance threshold for face matching */
const FACE_TOLERANCE = 0.45;

/** Minimum ms between detection loop iterations (throttle) */
const DETECT_INTERVAL_MS = 500;

export function useFaceApi(selectedPerson: string | null) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [presence, setPresence] = useState<'idle' | 'active' | 'error'>('idle');
  const [detectedUser, setDetectedUser] = useState<string | null>(null);
  const [lastFaceLocations, setLastFaceLocations] = useState<number[][]>([]);
  const [knownDescriptors, setKnownDescriptors] = useState<Record<string, number[]>>({});
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const requestRef = useRef<number | null>(null);
  const lastSyncRef = useRef<number>(0);

  // Grace-period refs for stable presence
  const lastMatchedPresenceRef = useRef<'idle' | 'active' | 'error'>('idle');
  const lastMatchTimeRef = useRef<number>(0);
  const graceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load models on mount
  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = '/models';
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        console.log("AI Models loaded successfully");
        setIsLoaded(true);
        fetchKnownDescriptors();
      } catch (err) {
        console.error("Failed to load AI models:", err);
        setPresence('error');
      }
    };

    const fetchKnownDescriptors = async () => {
      try {
        const res = await fetch('/api/face-descriptors');
        if (res.ok) {
          const data = await res.json();
          setKnownDescriptors(data);
        }
      } catch (e) {
        console.error("Failed to fetch known descriptors:", e);
      }
    };

    loadModels();
  }, []);

  // Camera Initialization
  useEffect(() => {
    if (!isLoaded) return;

    let stream: MediaStream | null = null;
    const startVideo = async () => {
      try {
        console.log("Requesting camera access...");
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 640, height: 480, facingMode: "user" } 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Wait for video to be ready
          videoRef.current.onloadedmetadata = () => {
            console.log("Video metadata loaded. Starting play...");
            videoRef.current?.play().then(() => {
              console.log("Video playing. Camera ready.");
              setIsVideoReady(true);
            }).catch(e => console.error("Video play error:", e));
          };
        }
      } catch (err: any) {
        console.error("Camera access error:", err);
        alert(`Camera Error: ${err.message}. Ensure HTTPS and permissions.`);
        setPresence('error');
      }
    };

    startVideo();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      setIsVideoReady(false);
    };
  }, [isLoaded]);

  /**
   * Stable presence updater with grace period.
   * Going from idle/error → active is INSTANT (start timer immediately).
   * Going from active → idle/error is DELAYED by PRESENCE_GRACE_MS
   * so brief detection misses don't flicker the stopwatch.
   */
  const updatePresenceStable = useCallback((rawPresence: 'idle' | 'active' | 'error') => {
    // Clear any pending grace timer
    if (graceTimerRef.current) {
      clearTimeout(graceTimerRef.current);
      graceTimerRef.current = null;
    }

    if (rawPresence === 'active') {
      // Immediately go active — no delay
      lastMatchedPresenceRef.current = 'active';
      lastMatchTimeRef.current = Date.now();
      setPresence('active');
    } else {
      // Only downgrade after grace period
      if (lastMatchedPresenceRef.current === 'active') {
        const elapsed = Date.now() - lastMatchTimeRef.current;
        const remaining = PRESENCE_GRACE_MS - elapsed;

        if (remaining <= 0) {
          // Grace period already expired
          lastMatchedPresenceRef.current = rawPresence;
          setPresence(rawPresence);
        } else {
          // Wait remaining grace period before downgrading
          graceTimerRef.current = setTimeout(() => {
            lastMatchedPresenceRef.current = rawPresence;
            setPresence(rawPresence);
            graceTimerRef.current = null;
          }, remaining);
        }
      } else {
        // Not currently active, update immediately
        lastMatchedPresenceRef.current = rawPresence;
        setPresence(rawPresence);
      }
    }
  }, []);

  // Detection loop — throttled to DETECT_INTERVAL_MS
  useEffect(() => {
    if (!isLoaded || !selectedPerson || !isVideoReady) {
      if (!selectedPerson) setPresence('idle');
      return;
    }

    let cancelled = false;

    const detect = async () => {
      if (cancelled) return;

      if (!videoRef.current || videoRef.current.paused || videoRef.current.ended || videoRef.current.readyState < 2) {
        requestRef.current = requestAnimationFrame(detect);
        return;
      }

      const loopStart = Date.now();

      // Detection
      const detections = await faceapi.detectAllFaces(
        videoRef.current, 
        new faceapi.TinyFaceDetectorOptions()
      ).withFaceLandmarks().withFaceDescriptors();

      if (cancelled) return;

      // Update UI boxes
      const boxes = detections.map(d => [
        d.detection.box.top,
        d.detection.box.right,
        d.detection.box.bottom,
        d.detection.box.left
      ]);
      setLastFaceLocations(boxes);

      // Match logic
      let matched = false;
      const targetDescriptor = knownDescriptors[selectedPerson.toLowerCase()];

      if (targetDescriptor) {
        const target = new Float32Array(targetDescriptor);
        for (const det of detections) {
          const distance = faceapi.euclideanDistance(det.descriptor, target);
          if (distance < FACE_TOLERANCE) {
            matched = true;
            break;
          }
        }
      }

      const newPresence = matched ? 'active' : (detections.length > 0 ? 'error' : 'idle');
      updatePresenceStable(newPresence);
      setDetectedUser(matched ? selectedPerson : null);

      // Sync status with backend periodically
      const now = Date.now();
      if (now - lastSyncRef.current > 2000) {
        syncPresence(newPresence, matched ? selectedPerson : null);
        lastSyncRef.current = now;
      }

      // Throttle: wait at least DETECT_INTERVAL_MS between iterations
      const elapsed = Date.now() - loopStart;
      const delay = Math.max(0, DETECT_INTERVAL_MS - elapsed);
      setTimeout(() => {
        if (!cancelled) {
          requestRef.current = requestAnimationFrame(detect);
        }
      }, delay);
    };

    const syncPresence = async (p: string, user: string | null) => {
      try {
        fetch('/api/sync-presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ presence: p, who: user })
        });
      } catch (e) {
        console.error("Presence sync failed:", e);
      }
    };

    requestRef.current = requestAnimationFrame(detect);

    return () => {
      cancelled = true;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (graceTimerRef.current) {
        clearTimeout(graceTimerRef.current);
        graceTimerRef.current = null;
      }
    };
  }, [isLoaded, isVideoReady, selectedPerson, knownDescriptors, updatePresenceStable]);

  /**
   * Enroll a face from the current webcam frame.
   * Guards:
   *  1. Multiple faces → warning
   *  2. Already-enrolled face → warning
   *  3. No face → warning
   */
  const enrollFace = async (name: string): Promise<{ success: boolean; message?: string }> => {
    if (!videoRef.current || !isLoaded || !isVideoReady) {
       return { success: false, message: "Camera or AI models not ready. Please wait." };
    }
    
    if (videoRef.current.readyState < 2) {
       return { success: false, message: "Video stream initializing. Please try again in a moment." };
    }

    try {
      console.log(`Starting enrollment for: ${name}`);

      // ── Guard 1: Check for multiple faces ──────────────────
      const allDetections = await faceapi.detectAllFaces(
        videoRef.current,
        new faceapi.TinyFaceDetectorOptions()
      ).withFaceLandmarks().withFaceDescriptors();

      if (allDetections.length === 0) {
        return { success: false, message: "No face detected. Look directly at the camera with good lighting." };
      }

      if (allDetections.length > 1) {
        return {
          success: false,
          message: `⚠️ Multiple faces detected (${allDetections.length}). Please ensure only ONE face is visible in the frame during enrollment.`
        };
      }

      const detection = allDetections[0];
      const newDescriptor = detection.descriptor;

      // ── Guard 2: Check for already-enrolled face ───────────
      for (const [existingName, existingDesc] of Object.entries(knownDescriptors)) {
        const distance = faceapi.euclideanDistance(
          newDescriptor,
          new Float32Array(existingDesc)
        );
        if (distance < FACE_TOLERANCE) {
          return {
            success: false,
            message: `⚠️ This face is already enrolled as "${existingName}". Each person can only be enrolled once.`
          };
        }
      }

      // ── Proceed with enrollment ────────────────────────────
      console.log("Face detected. Sending descriptor to backend...");
      const res = await fetch('/api/enroll-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          descriptor: Array.from(newDescriptor)
        }),
      });
      
      const data = await res.json();
      if (data.success) {
        setKnownDescriptors(prev => ({
          ...prev,
          [name.toLowerCase()]: Array.from(newDescriptor)
        }));
      }
      return { success: data.success, message: data.message };
    } catch (e: any) {
      console.error("Enrollment Exception:", e);
      return { success: false, message: `Enrollment Error: ${e.message || "Unknown error"}` };
    }
  };

  return { isLoaded, isVideoReady, videoRef, presence, detectedUser, enrollFace, lastFaceLocations };
}
