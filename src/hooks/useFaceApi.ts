import { useState, useEffect, useRef } from 'react';

export function useFaceApi(selectedPerson: string | null) {
  const isLoaded = true; // No local ML models to load anymore
  const [presence, setPresence] = useState<'idle' | 'active' | 'error'>('idle');
  const [detectedUser, setDetectedUser] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // Create an offscreen canvas to capture frames
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
      canvasRef.current.width = 640;
      canvasRef.current.height = 480;
    }

    let stream: MediaStream | null = null;
    let detectionInterval: number | null = null;

    const startVideo = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Camera error:", err);
      }
    };

    const processFrame = async () => {
      if (!videoRef.current || videoRef.current.paused || videoRef.current.ended || !canvasRef.current || !selectedPerson) {
        setPresence('idle');
        return;
      }

      // Draw the current video frame to the canvas
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
        
        // Convert to blob and send to backend
        canvasRef.current.toBlob(async (blob) => {
          if (!blob) return;

          const formData = new FormData();
          formData.append('frame', blob, 'frame.jpg');
          formData.append('selected_person', selectedPerson);

          try {
            // Using absolute URL to backend when calling via Vite proxy or directly
            const response = await fetch('http://127.0.0.1:5000/process-frame', {
              method: 'POST',
              body: formData
            });

            if (response.ok) {
              const data = await response.json();
              setPresence(data.presence);
              if (data.presence === 'active') {
                setDetectedUser(selectedPerson);
              } else {
                setDetectedUser(null);
              }
            } else {
              setPresence('error');
            }
          } catch (error) {
            console.error("Error pushing frame to backend:", error);
            setPresence('error');
          }
        }, 'image/jpeg', 0.8);
      }
    };

    videoRef.current?.addEventListener('play', () => {
      // Poll at backend every 1.5 seconds to limit server load
      detectionInterval = window.setInterval(processFrame, 1500);
    });

    startVideo();

    return () => {
      if (detectionInterval) clearInterval(detectionInterval);
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, [selectedPerson]);

  const enrollFace = async (name: string): Promise<boolean> => {
    if (!videoRef.current || !canvasRef.current) return false;
    
    return new Promise((resolve) => {
      const ctx = canvasRef.current!.getContext('2d');
      if (!ctx) return resolve(false);

      ctx.drawImage(videoRef.current!, 0, 0, canvasRef.current!.width, canvasRef.current!.height);
      
      canvasRef.current!.toBlob(async (blob) => {
        if (!blob) return resolve(false);

        const formData = new FormData();
        formData.append('photo', blob, 'enroll.jpg');
        formData.append('name', name);

        try {
          const res = await fetch('http://127.0.0.1:5000/enroll-photo', {
            method: 'POST',
            body: formData,
          });
          const data = await res.json();
          resolve(data.success);
        } catch (e) {
          console.error("WebRTC Enrollment Error:", e);
          resolve(false);
        }
      }, 'image/jpeg', 0.95);
    });
  };

  return { isLoaded, videoRef, presence, detectedUser, enrollFace };
}
