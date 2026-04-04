import { useState, useEffect } from 'react';
import { Clock, Zap } from 'lucide-react';
import StopwatchDisplay from './components/StopwatchDisplay';
import Controls from './components/Controls';
import SessionLog from './components/SessionLog';
import UserManagement from './components/UserManagement';

const SENSOR_ID = '123';
const API_BASE = 'http://localhost:5000';

export default function App() {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState<'idle' | 'running' | 'unauthorized'>('idle');
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [disconnected, setDisconnected] = useState(false);

  // Timer effect
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setElapsedTime((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  // Poll presence
  useEffect(() => {
    const pollPresence = async () => {
      try {
        const res = await fetch(`${API_BASE}/status/${SENSOR_ID}`);
        const data = await res.json();
        setDisconnected(false);

        if (data.Presence === 'active') {
          setStatus('running');
          if (!isRunning) setIsRunning(true);
        } else if (data.Presence === 'error') {
          setStatus('unauthorized');
          setIsRunning(false);
        } else {
          setStatus('idle');
          setIsRunning(false);
        }
      } catch (err) {
        setDisconnected(true);
        setStatus('idle');
        setIsRunning(false);
      }
    };

    const interval = setInterval(pollPresence, 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  const handleRestart = () => {
    setElapsedTime(0);
    setIsRunning(false);
    setStatus('idle');
  };

  const handleReconnect = async () => {
    try {
      const res = await fetch(`${API_BASE}/status/${SENSOR_ID}`);
      const data = await res.json();
      if (data.Presence === 'active') {
        setStatus('running');
        setIsRunning(true);
      }
      setDisconnected(false);
    } catch (err) {
      console.error('Reconnect failed:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface via-surface-variant to-surface overflow-hidden">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Blur orbs */}
        <div className="absolute w-[800px] h-[800px] bg-gradient-to-br from-primary/25 via-secondary/15 to-transparent rounded-full blur-3xl -top-40 -left-40 animate-float"></div>
        <div className="absolute w-[600px] h-[600px] bg-gradient-to-br from-tertiary/20 via-primary/10 to-transparent rounded-full blur-3xl -bottom-32 -right-32 animate-float-delayed"></div>
        <div className="absolute w-[500px] h-[500px] bg-gradient-to-br from-secondary/20 to-transparent rounded-full blur-2xl top-1/3 right-1/4 opacity-40 animate-float"></div>

        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[3%] bg-grid-pattern"></div>
      </div>

      <div className="relative z-10">
        <div className="min-h-screen flex items-center justify-center p-4 py-8">
          <div className="w-full max-w-3xl">
            {/* Header */}
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
                Study Tracker
              </h1>
              <p className="text-outline-variant font-label text-lg flex items-center justify-center gap-2">
                <Zap className="w-5 h-5 text-secondary" />
                AI-Powered Presence Detection
              </p>
            </div>

            {/* Main Card Container */}
            <div className="space-y-6">
              {/* Stopwatch Display */}
              <StopwatchDisplay
                elapsedTime={elapsedTime}
                status={status}
                disconnected={disconnected}
              />

              {/* Controls */}
              <Controls
                onRestart={handleRestart}
                onReconnect={handleReconnect}
              />

              {/* Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Session Log */}
                <SessionLog />

                {/* User Management */}
                <UserManagement
                  selectedPerson={selectedPerson}
                  onPersonSelected={setSelectedPerson}
                />
              </div>
            </div>

            {/* Footer Stats */}
            <div className="mt-16 grid grid-cols-3 gap-4 fade-in-up delay-3">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 text-center hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 transition-all duration-300">
                <p className="text-3xl font-black text-primary mb-2">∞</p>
                <p className="text-xs text-outline-variant font-label tracking-wider">Live Tracking</p>
              </div>
              <div className="p-4 rounded-2xl bg-gradient-to-br from-secondary/10 to-transparent border border-secondary/20 text-center hover:border-secondary/40 hover:shadow-lg hover:shadow-secondary/10 transition-all duration-300">
                <p className="text-3xl font-black text-secondary mb-2">AI</p>
                <p className="text-xs text-outline-variant font-label tracking-wider">Smart Detection</p>
              </div>
              <div className="p-4 rounded-2xl bg-gradient-to-br from-tertiary/10 to-transparent border border-tertiary/20 text-center hover:border-tertiary/40 hover:shadow-lg hover:shadow-tertiary/10 transition-all duration-300">
                <p className="text-3xl font-black text-tertiary mb-2">✓</p>
                <p className="text-xs text-outline-variant font-label tracking-wider">Verified</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
