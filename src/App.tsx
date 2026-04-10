import { useState, useEffect, useRef } from 'react';
import { Clock, Zap } from 'lucide-react';
import StopwatchDisplay from './components/StopwatchDisplay';
import Controls from './components/Controls';
import SessionLog from './components/SessionLog';
import UserManagement from './components/UserManagement';
import { useFaceApi } from './hooks/useFaceApi';
import { logSession } from './lib/storage';

export default function App() {
  const [accumulatedTime, setAccumulatedTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [sessionISOStart, setSessionISOStart] = useState<string | null>(null);
  const [sessionTimestamp, setSessionTimestamp] = useState<number | null>(null);
  const [displayTime, setDisplayTime] = useState(0);
  
  // Custom hook wrapping face-api.js
  const { isLoaded, videoRef, presence, enrollFace, lastFaceLocations } = useFaceApi(selectedPerson);
  const overlayRef = useRef<HTMLCanvasElement>(null);

  // Status mapping
  let displayStatus: 'idle' | 'running' | 'unauthorized' = 'idle';
  if (presence === 'active') displayStatus = 'running';
  else if (presence === 'error') displayStatus = 'unauthorized';

  // Face Detection / Presence Effect logic
  useEffect(() => {
    if (presence === 'active') {
      if (!isRunning) {
        setIsRunning(true);
        setSessionTimestamp(Date.now());
        setSessionISOStart(new Date().toISOString());
      }
    } else {
      if (isRunning) {
        setIsRunning(false);
        if (sessionTimestamp) {
          // Use Math.round for consistent accumulation with the display logic
          const delta = Math.round((Date.now() - sessionTimestamp) / 1000);
          setAccumulatedTime(prev => prev + delta);
        }
        if (sessionISOStart) {
          logSession(sessionISOStart, new Date().toISOString());
          setSessionISOStart(null);
        }
        setSessionTimestamp(null);
      }
    }
  }, [presence, isRunning, sessionTimestamp, sessionISOStart]);
  
  // Timer Display Update (Smooth & Drift-Free)
  useEffect(() => {
    const interval = setInterval(() => {
      if (isRunning && sessionTimestamp) {
        // Higher frequency update (100ms) with Math.round for "consecutive" feel
        const elapsed = Math.round((Date.now() - sessionTimestamp) / 1000);
        setDisplayTime(accumulatedTime + elapsed);
      } else {
        setDisplayTime(accumulatedTime);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isRunning, sessionTimestamp, accumulatedTime]);

  // Draw face overlay
  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (lastFaceLocations.length === 0) return;

    ctx.strokeStyle = '#3b82f6'; // primary color
    ctx.lineWidth = 3;
    ctx.beginPath();

    lastFaceLocations.forEach(loc => {
      const [top, right, bottom, left] = loc;
      const width = right - left;
      const height = bottom - top;
      ctx.strokeRect(left, top, width, height);
      
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(left, top - 25, 70, 25);
      ctx.fillStyle = 'white';
      ctx.font = 'bold 14px Inter';
      ctx.fillText('FACE', left + 5, top - 7);
    });
  }, [lastFaceLocations]);

  const handleRestart = () => {
    setAccumulatedTime(0);
    setDisplayTime(0);
    if (isRunning) {
      setSessionTimestamp(Date.now());
      if (sessionISOStart) {
        logSession(sessionISOStart, new Date().toISOString());
        setSessionISOStart(new Date().toISOString());
      }
    }
  };

  const handleReconnect = () => {
    console.log("Reconnect requested (Client only mode)");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface via-surface-variant to-surface overflow-hidden">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-[800px] h-[800px] bg-gradient-to-br from-primary/25 via-secondary/15 to-transparent rounded-full blur-3xl -top-40 -left-40 animate-float"></div>
        <div className="absolute w-[600px] h-[600px] bg-gradient-to-br from-tertiary/20 via-primary/10 to-transparent rounded-full blur-3xl -bottom-32 -right-32 animate-float-delayed"></div>
        <div className="absolute w-[500px] h-[500px] bg-gradient-to-br from-secondary/20 to-transparent rounded-full blur-2xl top-1/3 right-1/4 opacity-40 animate-float"></div>
        <div className="absolute inset-0 opacity-[3%] bg-grid-pattern"></div>
      </div>

      <div className="relative z-10 flex flex-col xl:flex-row items-center justify-center p-4 py-8 min-h-screen gap-8">
        
        {/* Left Side: Video Feed */}
        <div className="w-full xl:w-1/4 flex flex-col items-center">
           <div className="relative overflow-hidden rounded-3xl border-2 border-primary/40 bg-surface-variant/50 mb-4 shadow-xl scale-x-[-1]">
             <video ref={videoRef} autoPlay muted playsInline className="w-full h-auto max-w-[300px] object-cover" />
             <canvas 
               ref={overlayRef} 
               width={640} 
               height={480} 
               className="absolute inset-0 w-full h-full pointer-events-none" 
             />
             {!isLoaded && (
               <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-primary font-bold animate-pulse">
                 Starting Browser Camera...
               </div>
             )}
             {isLoaded && <div className="absolute top-2 right-2 flex gap-1">
                <span className={`w-3 h-3 rounded-full ${presentationColor(displayStatus)}`}></span>
             </div>}
           </div>
        </div>

        <div className="w-full max-w-3xl">
          <div className="text-center mb-12 animate-fade-in">
            <div className="inline-flex items-center justify-center mb-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-primary via-secondary to-tertiary rounded-2xl blur-xl opacity-60 animate-pulse"></div>
                <div className="relative bg-surface-bright rounded-2xl p-4 border border-primary/40">
                  <Clock className="w-12 h-12 text-primary" />
                </div>
              </div>
            </div>
            <h1 className="text-5xl font-black bg-gradient-to-r from-primary via-secondary to-tertiary bg-clip-text text-transparent font-headline mb-2">
              Blinq Presence Time Calculator
            </h1>
            <p className="text-outline-variant font-label text-lg flex items-center justify-center gap-2">
              <Zap className="w-5 h-5 text-secondary" />
              AI-Powered Serverless Presence Detection
            </p>
          </div>

          <div className="space-y-6">
            <StopwatchDisplay
              elapsedTime={displayTime}
              status={displayStatus}
              disconnected={!isLoaded}
            />

            <Controls
              onRestart={handleRestart}
              onReconnect={handleReconnect}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SessionLog />

              <UserManagement
                selectedPerson={selectedPerson}
                onPersonSelected={setSelectedPerson}
                enrollFace={enrollFace}
                isCameraReady={isLoaded}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

