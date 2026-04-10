import { useState, useEffect, useRef } from 'react';

export function useFaceApi(selectedPerson: string | null) {
  const isLoaded = true; // No local ML models to load anymore
  const [presence, setPresence] = useState<'idle' | 'active' | 'error'>('idle');
  const [detectedUser, setDetectedUser] = useState<string | null>(null);
  const [lastFaceLocations, setLastFaceLocations] = useState<number[][]>([]);
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
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 640, height: 480, facingMode: "user" } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Browser Camera access denied/error:", err);
        setPresence('error');
        alert("Camera access denied by browser. Please grant permissions to enable presence detection.");
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
            // Relative paths for Vercel/proxied local dev
            const response = await fetch('/process-frame', {
              method: 'POST',
              body: formData
            });

            if (response.ok) {
              const data = await response.json();
              setPresence(data.presence);
              setLastFaceLocations(data.faces || []);
              
              if (data.presence === 'active') {
                setDetectedUser(selectedPerson);
              } else {
                setDetectedUser(null);
              }
            } else {
              setPresence('error');
              setLastFaceLocations([]);
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

  const enrollFace = async (name: string): Promise<{ success: boolean; message?: string }> => {
    if (!videoRef.current || !canvasRef.current) return { success: false, message: "Hardware not ready" };
    
    return new Promise((resolve) => {
      const ctx = canvasRef.current!.getContext('2d');
      if (!ctx) return resolve(false);

      ctx.drawImage(videoRef.current!, 0, 0, canvasRef.current!.width, canvasRef.current!.height);
      
      canvasRef.current!.toBlob(async (blob) => {
        if (!blob) return resolve({ success: false, message: "Failed to capture frame from canvas" });

        const formData = new FormData();
        formData.append('photo', blob, 'enroll.jpg');
        formData.append('name', name);

        try {
          // Relative path for enrollment as well
          const res = await fetch('/enroll-photo', {
            method: 'POST',
            body: formData,
          });
          const data = await res.json();
          
          if (data.faces && data.faces.length > 0) {
            setLastFaceLocations(data.faces);
            // Clear box after 3 seconds so it doesn't stay forever
            setTimeout(() => setLastFaceLocations([]), 3000);
          } else {
            setLastFaceLocations([]);
          }

          if (!res.ok) {
            console.warn("Enrollment failed:", data.message);
          }
          resolve({ success: data.success, message: data.message });
        } catch (e) {
          console.error("WebRTC Enrollment Error:", e);
          setLastFaceLocations([]);
          resolve({ success: false, message: e instanceof Error ? e.message : "Unknown enrollment error" });
        }
      }, 'image/jpeg', 0.95);
    });
  };

  return { isLoaded, videoRef, presence, detectedUser, enrollFace, lastFaceLocations };
}
