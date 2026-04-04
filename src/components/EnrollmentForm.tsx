import { useState } from 'react';
import { Camera, Upload, AlertCircle, Sparkles } from 'lucide-react';

interface Props {
  onUserAdded: () => void;
}

export default function EnrollmentForm({ onUserAdded }: Props) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const enrollViaWebcam = async () => {
    if (!name.trim()) {
      setError('Please enter a name');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('http://localhost:5000/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();

      if (data.success) {
        setSuccess(data.message || '✓ Enrollment successful');
        setName('');
        onUserAdded();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.message || 'Enrollment failed');
      }
    } catch (err) {
      setError('Enrollment error: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
    setLoading(false);
  };

  const enrollViaPhoto = async () => {
    if (!name.trim()) {
      setError('Please enter a name');
      return;
    }
    if (!photoFile) {
      setError('Please select a photo');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('photo', photoFile);

      const res = await fetch('http://localhost:5000/enroll-photo', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        setSuccess(data.message || '✓ Photo enrollment successful');
        setName('');
        setPhotoFile(null);
        onUserAdded();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.message || 'Photo enrollment failed');
      }
    } catch (err) {
      setError('Photo enrollment error: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
    setLoading(false);
  };

  return (
    <div className="relative overflow-hidden border border-secondary/40 rounded-3xl bg-gradient-to-br from-secondary/20 via-secondary/5 to-tertiary/10 backdrop-blur-premium fade-in-up delay-1">
      {/* Decorative gradient overlay */}
      <div className="absolute -inset-px bg-gradient-to-r from-secondary/20 via-transparent to-tertiary/20 rounded-3xl opacity-0 group-hover:opacity-30 transition-opacity duration-500"></div>
      {/* Shimmer effect on hover */}
      <div className="absolute inset-0 shimmer opacity-0 hover:opacity-20 transition-opacity duration-500 rounded-3xl"></div>

      <div className="relative p-8 space-y-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-secondary/40 to-secondary/10 border border-secondary/50 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-secondary" />
          </div>
          <h3 className="text-xl font-bold font-headline text-secondary">Enroll User</h3>
        </div>

        {/* Name Input */}
        <div>
          <label className="block text-sm text-outline-variant font-label mb-2">Full Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter name"
            className="w-full px-4 py-3 rounded-xl bg-surface/80 border border-outline-variant/40 text-white placeholder:text-outline-variant/50 focus:outline-none focus:border-secondary/60 focus:bg-surface/60 focus:ring-2 focus:ring-secondary/30 transition-all duration-300 input-focus disabled:opacity-50"
            disabled={loading}
          />
        </div>

        {/* Messages */}
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

        {/* Webcam Enrollment */}
        <button
          onClick={enrollViaWebcam}
          disabled={loading || !name.trim()}
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
            <span>{loading ? 'Processing...' : 'Enroll via Webcam'}</span>
          </div>
        </button>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-outline-variant/30"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-3 bg-surface/80 text-outline-variant/70 font-label">Or upload photo</span>
          </div>
        </div>

        {/* Photo Upload */}
        <div className="space-y-3">
          <label className="cursor-pointer block">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/bmp"
              onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
              disabled={loading}
              className="hidden"
            />
            <div className="flex items-center justify-center px-4 py-4 rounded-xl border-2 border-dashed border-outline-variant/40 hover:border-secondary/60 bg-surface/40 hover:bg-surface/60 transition-all duration-300 cursor-pointer hover:shadow-lg hover:shadow-secondary/10">
              <div className="text-center">
                <Upload className="w-5 h-5 text-outline-variant mx-auto mb-2" />
                <p className="text-sm text-outline-variant font-label">
                  {photoFile ? (
                    <span className="text-secondary font-semibold">{photoFile.name}</span>
                  ) : (
                    'Click to upload photo'
                  )}
                </p>
              </div>
            </div>
          </label>

          <button
            onClick={enrollViaPhoto}
            disabled={loading || !name.trim() || !photoFile}
            className="btn-base w-full group relative px-4 py-3 rounded-xl font-bold font-label text-base transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden shadow-lg shadow-green-500/20 hover:shadow-2xl hover:shadow-green-500/40"
            style={{
              background: 'linear-gradient(135deg, #c3f400 0%, #7d8a00 100%)',
              color: '#0c0e12',
            }}
          >
            <div className="absolute inset-0 rounded-xl bg-white/0 group-hover:bg-white/20 transition-colors duration-300"></div>
            <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative flex items-center justify-center gap-2 z-10">
              <Upload className="w-5 h-5" />
              <span>{loading ? 'Processing...' : 'Upload & Enroll'}</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
