import { useState, useEffect } from 'react';
import { RotateCcw, Trash2, RefreshCw, Zap } from 'lucide-react';
import { getSessionLog, clearSessionLog, Session } from '../lib/storage';

export default function SessionLog() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);

  const loadSessions = () => {
    setLoading(true);
    setSessions(getSessionLog().reverse());
    setTimeout(() => setLoading(false), 300); // UI feedback
  };

  const clearSessions = () => {
    if (!confirm('Clear all session logs?')) return;
    clearSessionLog();
    loadSessions();
  };

  useEffect(() => {
    loadSessions();
    const interval = setInterval(loadSessions, 5000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-4 fade-in-up">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/40 flex items-center justify-center hover:border-primary/60 transition-colors">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-2xl font-bold font-headline text-primary">Session Log</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadSessions}
            disabled={loading}
            className="p-2.5 rounded-lg bg-outline-variant/20 hover:bg-outline-variant/40 hover:border-primary/60 transition-all disabled:opacity-50 border border-outline-variant/20 hover-lift"
          >
            <RefreshCw className={`w-4 h-4 text-primary ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={clearSessions}
            className="p-2.5 rounded-lg bg-error/20 hover:bg-error/40 transition-all border border-error/20 text-error hover-lift"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="bg-gradient-to-br from-surface-container/60 via-surface/50 to-surface-variant/40 rounded-3xl border border-outline-variant/30 overflow-hidden backdrop-blur-premium hover:border-primary/40 transition-all duration-300">
        <div className="max-h-80 overflow-y-auto custom-scrollbar">
          {sessions.length === 0 ? (
            <div className="p-8 text-center">
              <div className="animate-pulse opacity-50 inline-block mb-3">
                <RotateCcw className="w-8 h-8 text-outline-variant/40" />
              </div>
              <p className="text-outline-variant font-label">No sessions logged yet</p>
            </div>
          ) : (
            <ul className="divide-y divide-outline-variant/20">
              {sessions.map((session) => (
                <li
                  key={session.id}
                  className="p-4 hover:bg-primary/5 transition-all duration-200 group border-l-2 border-transparent hover:border-secondary"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-secondary font-mono font-semibold group-hover:text-primary transition-colors">
                        Local Browser
                      </p>
                      <div className="flex items-center gap-2 text-xs text-outline-variant mt-2">
                        <span className="px-2 py-1 rounded-lg bg-gradient-to-r from-primary/20 to-primary/10 text-primary/90 font-semibold">
                          {formatDate(session.startTime)}
                        </span>
                        <span className="group-hover:text-primary/80 transition-colors">{formatTime(session.startTime)} → {formatTime(session.endTime)}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-primary font-black font-label text-lg group-hover:text-secondary transition-colors">
                        {Math.floor(session.duration / 60)}m
                      </p>
                      <p className="text-xs text-outline-variant">{session.duration % 60}s</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
