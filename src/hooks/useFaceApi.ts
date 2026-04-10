import { useState, useEffect, useRef } from 'react';
import * as faceapi from 'face-api.js';

export function useFaceApi(selectedPerson: string | null) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [presence, setPresence] = useState<'idle' | 'active' | 'error'>('idle');
  const [detectedUser, setDetectedUser] = useState<string | null>(null);
  const [lastFaceLocations, setLastFaceLocations] = useState<number[][]>([]);
  const [knownDescriptors, setKnownDescriptors] = useState<Record<string, number[]>>({});
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const requestRef = useRef<number>(null);
  const lastSyncRef = useRef<number>(0);

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

  // Detection loop
  useEffect(() => {
    if (!isLoaded || !selectedPerson) return;

    let stream: MediaStream | null = null;
    const faceTolerance = 0.45; // Match config.py

    const startVideo = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 640, height: 480, facingMode: "user" } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Camera access error:", err);
        setPresence('error');
      }
    };

    const detect = async () => {
      if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) {
        requestRef.current = requestAnimationFrame(detect);
        return;
      }

      // Detection
      const detections = await faceapi.detectAllFaces(
        videoRef.current, 
        new faceapi.TinyFaceDetectorOptions()
      ).withFaceLandmarks().withFaceDescriptors();

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
          if (distance < faceTolerance) {
            matched = true;
            break;
          }
        }
      }

      const newPresence = matched ? 'active' : (detections.length > 0 ? 'error' : 'idle');
      setPresence(newPresence);
      setDetectedUser(matched ? selectedPerson : null);

      // Sync status with backend periodically (every 2 seconds)
      const now = Date.now();
      if (now - lastSyncRef.current > 2000) {
        syncPresence(newPresence, matched ? selectedPerson : null);
        lastSyncRef.current = now;
      }

      requestRef.current = requestAnimationFrame(detect);
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

    startVideo().then(() => {
      requestRef.current = requestAnimationFrame(detect);
    });

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, [isLoaded, selectedPerson, knownDescriptors]);

  const enrollFace = async (name: string): Promise<{ success: boolean; message?: string }> => {
    if (!videoRef.current || !isLoaded) return { success: false, message: "AI Models not ready" };
    
    try {
      const detection = await faceapi.detectSingleFace(
        videoRef.current, 
        new faceapi.TinyFaceDetectorOptions()
      ).withFaceLandmarks().withFaceDescriptor();

      if (!detection) {
        return { success: false, message: "No face detected. Please look clearly at the camera." };
      }

      // Send the high-quality 128-float descriptor to the backend
      const res = await fetch('/api/enroll-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          descriptor: Array.from(detection.descriptor)
        }),
      });
      
      const data = await res.json();
      if (data.success) {
        // Update local reference so recognition works immediately
        setKnownDescriptors(prev => ({
          ...prev,
          [name.toLowerCase()]: Array.from(detection.descriptor)
        }));
      }
      return { success: data.success, message: data.message };
    } catch (e) {
      console.error("Enrollment error:", e);
      return { success: false, message: "Client-side enrollment failed." };
    }
  };

  return { isLoaded, videoRef, presence, detectedUser, enrollFace, lastFaceLocations };
}
