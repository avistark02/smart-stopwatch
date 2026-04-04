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
    <div className={`relative overflow-hidden rounded-3xl p-12 text-center ${status === 'running' ? 'animate-pulse-glow' : ''}`}>
      {/* Background gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${config.bg} border ${config.border}`}></div>

      {/* Glow effect when running */}
      {status === 'running' && (
        <>
          <div className="absolute -inset-1 bg-gradient-to-r from-secondary via-primary to-tertiary rounded-3xl blur-2xl opacity-30 animate-pulse"></div>
          <div className="absolute -inset-0.5 bg-gradient-to-r from-secondary via-primary to-tertiary rounded-3xl blur-xl opacity-20 animate-pulse"></div>
        </>
      )}

      <div className="relative z-10 space-y-6">
        {/* Time Display */}
        <div>
          <div className="text-7xl font-black font-headline bg-gradient-to-r from-primary via-secondary to-tertiary bg-clip-text text-transparent tracking-wider drop-shadow-lg">
            {formatTime(elapsedTime)}
          </div>
          <p className="text-outline-variant text-sm mt-3 font-label tracking-widest">ELAPSED TIME</p>
        </div>

        {/* Status Badge */}
        <div className={`inline-flex items-center justify-center gap-2 rounded-full py-2.5 px-6 bg-gradient-to-r ${config.bg} border ${config.border} backdrop-blur-sm`}>
          <span className={`${config.color} animate-pulse`}>{config.icon}</span>
          <span className={`${config.color} font-bold font-label text-base tracking-wide`}>{config.text}</span>
        </div>
      </div>
    </div>
  );
}
