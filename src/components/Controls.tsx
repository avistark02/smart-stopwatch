import { RotateCcw, RefreshCw } from 'lucide-react';

interface Props {
  onRestart: () => void;
  onReconnect: () => void;
}

export default function Controls({ onRestart, onReconnect }: Props) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Restart Button */}
      <button
        onClick={onRestart}
        className="btn-base group relative overflow-hidden px-6 py-4 font-bold font-label text-base text-white shadow-lg shadow-red-600/20 hover:shadow-2xl hover:shadow-red-600/40 active:translate-y-0"
        style={{
          background: 'linear-gradient(135deg, #ff716c 0%, #c91e1e 100%)',
        }}
      >
        <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-300"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-20 group-hover:animate-pulse transition-opacity"></div>
        <div className="relative flex items-center justify-center gap-2 z-10">
          <RotateCcw className="w-5 h-5" />
          <span>Restart</span>
        </div>
      </button>

      {/* Reconnect Button */}
      <button
        onClick={onReconnect}
        className="btn-base group relative overflow-hidden px-6 py-4 font-bold font-label text-base shadow-lg shadow-cyan-400/20 hover:shadow-2xl hover:shadow-cyan-400/40 active:translate-y-0"
        style={{
          background: 'linear-gradient(135deg, #a1faff 0%, #00575b 100%)',
          color: '#0c0e12',
        }}
      >
        <div className="absolute inset-0 bg-white/0 group-hover:bg-white/20 transition-colors duration-300"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-30 group-hover:animate-pulse transition-opacity"></div>
        <div className="relative flex items-center justify-center gap-2 z-10">
          <RefreshCw className="w-5 h-5" />
          <span>Reconnect</span>
        </div>
      </button>
    </div>
  );
}
