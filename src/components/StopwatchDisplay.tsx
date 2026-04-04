import { Activity, AlertCircle, Clock } from 'lucide-react';

interface Props {
  elapsedTime: number;
  status: 'idle' | 'running' | 'unauthorized';
  disconnected: boolean;
}

export default function StopwatchDisplay({ elapsedTime, status, disconnected }: Props) {
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const getStatusConfig = () => {
    if (disconnected) {
      return {
        icon: <AlertCircle className="w-5 h-5" />,
        text: 'Disconnected',
        color: 'text-error',
        bg: 'from-error/20 to-error/10',
        border: 'border-error/40',
      };
    }
    switch (status) {
      case 'running':
        return {
          icon: <Activity className="w-5 h-5" />,
          text: 'Active',
          color: 'text-secondary',
          bg: 'from-secondary/20 to-secondary/10',
          border: 'border-secondary/40',
          glow: true,
        };
      case 'unauthorized':
        return {
          icon: <AlertCircle className="w-5 h-5" />,
          text: 'Unauthorized',
          color: 'text-error',
          bg: 'from-error/20 to-error/10',
          border: 'border-error/40',
        };
      default:
        return {
          icon: <Clock className="w-5 h-5" />,
          text: 'Idle',
          color: 'text-primary',
          bg: 'from-primary/20 to-primary/10',
          border: 'border-primary/40',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className={`relative overflow-hidden rounded-3xl backdrop-blur-xl border ${
      status === 'running'
        ? 'border-secondary/60 bg-gradient-to-br from-secondary/15 via-surface-container/50 to-surface/30'
        : 'border-outline-variant/30 bg-gradient-to-br from-surface-container/60 to-surface/40'
    } transition-all duration-500 ${status === 'running' ? 'animate-pulse-glow' : ''}`}>

      {/* Premium card background */}
      <div className={`absolute inset-0 rounded-3xl ${status === 'running' ? 'bg-gradient-to-br from-secondary/5 via-primary/5 to-transparent' : 'bg-gradient-to-br from-primary/5 via-transparent to-secondary/5'} opacity-50`}></div>

      {/* Glow effect when running */}
      {status === 'running' && (
        <>
          <div className="absolute -inset-1 bg-gradient-to-r from-secondary via-primary to-tertiary rounded-3xl blur-2xl opacity-20 animate-pulse"></div>
          <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 to-transparent rounded-3xl opacity-0 hover:opacity-100 transition-opacity duration-500"></div>
        </>
      )}

      <div className="relative z-10 p-12 md:p-16 space-y-8">
        {/* Time Display */}
        <div className="space-y-3">
          <div className="text-7xl md:text-8xl font-black font-headline bg-gradient-to-r from-primary via-secondary to-tertiary bg-clip-text text-transparent tracking-wider drop-shadow-2xl">
            {formatTime(elapsedTime)}
          </div>
          <p className="text-outline-variant text-sm font-label tracking-widest uppercase">Elapsed Time</p>
        </div>

        {/* Status Badge */}
        <div className="flex justify-center">
          <div className={`inline-flex items-center justify-center gap-3 rounded-full py-3 px-8 border transition-all duration-300 ${
            disconnected
              ? 'bg-gradient-to-r from-error/20 to-error/10 border-error/40'
              : status === 'running'
              ? 'bg-gradient-to-r from-secondary/30 to-secondary/10 border-secondary/50 shadow-lg shadow-secondary/20'
              : 'bg-gradient-to-r from-primary/20 to-primary/10 border-primary/40'
          } backdrop-blur-sm hover:shadow-xl hover:-translate-y-0.5 transition-all`}>
            <span className={`${
              disconnected ? 'text-error' : status === 'running' ? 'text-secondary' : 'text-primary'
            } animate-pulse`}>{config.icon}</span>
            <span className={`font-bold font-label text-base tracking-wide ${
              disconnected ? 'text-error' : status === 'running' ? 'text-secondary' : 'text-primary'
            }`}>{config.text}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
