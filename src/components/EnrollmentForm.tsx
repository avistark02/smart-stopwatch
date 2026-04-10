import { useState } from 'react';
import { Camera, AlertCircle, Sparkles } from 'lucide-react';

interface Props {
  onUserAdded: () => void;
  enrollFace: (name: string) => Promise<boolean>;
  isCameraReady: boolean;
}

export default function EnrollmentForm({ onUserAdded, enrollFace, isCameraReady }: Props) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const enrollViaWebcam = async () => {
    if (!name.trim()) {
      setError('Please enter a name');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const success = await enrollFace(name.trim());
      if (success) {
        setSuccess('✓ Enrollment successful via Browser Camera');
        setName('');
        onUserAdded();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError('No face detected or enrollment failed. Make sure your browser has camera permissions and you are visible.');
      }
    } catch (err) {
      setError('Enrollment error: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
    setLoading(false);
  };

  return (
    <div className="relative overflow-hidden border border-secondary/40 rounded-3xl bg-gradient-to-br from-secondary/20 via-secondary/5 to-tertiary/10 backdrop-blur-premium fade-in-up delay-1">
      <div className="absolute -inset-px bg-gradient-to-r from-secondary/20 via-transparent to-tertiary/20 rounded-3xl opacity-0 group-hover:opacity-30 transition-opacity duration-500"></div>
      <div className="absolute inset-0 shimmer opacity-0 hover:opacity-20 transition-opacity duration-500 rounded-3xl"></div>

      <div className="relative p-8 space-y-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-secondary/40 to-secondary/10 border border-secondary/50 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-secondary" />
          </div>
          <h3 className="text-xl font-bold font-headline text-secondary">Enroll User</h3>
        </div>

        <div>
          <label className="block text-sm text-outline-variant font-label mb-2">Full Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter name"
            className="w-full px-4 py-3 rounded-xl bg-surface/80 border border-outline-variant/40 text-white placeholder:text-outline-variant/50 focus:outline-none focus:border-secondary/60 focus:bg-surface/60 focus:ring-2 focus:ring-secondary/30 transition-all duration-300 input-focus disabled:opacity-50"
            disabled={loading || !isCameraReady}
          />
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-error/20 border border-error/40 flex items-center gap-3 text-error text-sm font-label animate-pulse-once backdrop-blur-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="p-4 rounded-xl bg-secondary/20 border border-secondary/40 text-secondary text-sm font-bold font-label backdrop-blur-sm animate-fade-in">
            {success}
          </div>
        )}

        <button
          onClick={enrollViaWebcam}
          disabled={loading || !name.trim() || !isCameraReady}
          className="btn-base w-full group relative px-4 py-3 rounded-xl font-bold font-label text-base transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden shadow-lg shadow-cyan-400/20 hover:shadow-2xl hover:shadow-cyan-400/40"
          style={{
            background: 'linear-gradient(135deg, #a1faff 0%, #00575b 100%)',
            color: '#0c0e12',
          }}
        >
          <div className="absolute inset-0 rounded-xl bg-white/0 group-hover:bg-white/20 transition-colors duration-300"></div>
          <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="relative flex items-center justify-center gap-2 z-10">
            <Camera className="w-5 h-5" />
            <span>{!isCameraReady ? 'Loading Camera...' : loading ? 'Processing...' : 'Enroll via Webcam'}</span>
          </div>
        </button>
      </div>
    </div>
  );
}
