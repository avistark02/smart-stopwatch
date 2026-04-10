import { useState, useEffect, useRef } from 'react';
declare const faceapi: any;
import { getAuthorizedUsers } from '../lib/storage';

const MODEL_URL = '/models';
const FACE_TOLERANCE = 0.45;

export function useFaceApi(selectedPerson: string | null) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [presence, setPresence] = useState<'idle' | 'active' | 'error'>('idle');
  const [detectedUser, setDetectedUser] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const loadModels = async () => {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
      ]);
      setIsLoaded(true);
    };
    loadModels();
  }, []);

  useEffect(() => {
    if (!videoRef.current || !isLoaded) return;

    let stream: MediaStream | null = null;
    let detectionInterval: number | null = null;

    const startVideo = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Camera error:", err);
      }
    };

    const detectFaces = async () => {
      if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;

      const detections = await faceapi.detectAllFaces(
        videoRef.current,
        new faceapi.TinyFaceDetectorOptions()
      ).withFaceLandmarks().withFaceDescriptors();

      if (!selectedPerson) {
        setPresence('idle');
        return;
      }

      if (detections.length === 0) {
        setPresence('idle');
        return;
      }

      const users = getAuthorizedUsers();
      const targetUser = users.find(u => u.name === selectedPerson);
      
      if (!targetUser) {
        setPresence('idle');
        return;
      }

      const targetDescriptor = new Float32Array(JSON.parse(targetUser.descriptor));
      let authorizedPresent = false;

      for (const detection of detections) {
        const distance = faceapi.euclideanDistance(targetDescriptor, detection.descriptor);
        if (distance < FACE_TOLERANCE) {
          authorizedPresent = true;
          break;
        }
      }

      if (authorizedPresent) {
        setPresence('active');
        setDetectedUser(selectedPerson);
      } else {
        setPresence('error');
      }
    };

    videoRef.current.addEventListener('play', () => {
      detectionInterval = window.setInterval(detectFaces, 1000); // 1 FPS polling
    });

    startVideo();

    return () => {
      if (detectionInterval) clearInterval(detectionInterval);
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, [isLoaded, selectedPerson]);

  const enrollFace = async (name: string): Promise<boolean> => {
    if (!videoRef.current) return false;
    const detection = await faceapi.detectSingleFace(
      videoRef.current,
      new faceapi.TinyFaceDetectorOptions()
    ).withFaceLandmarks().withFaceDescriptor();

    if (!detection) return false;
    
    import('../lib/storage').then(({ enrollUser }) => {
      enrollUser(name, detection.descriptor);
    });
    return true;
  };

  return { isLoaded, videoRef, presence, detectedUser, enrollFace };
}
