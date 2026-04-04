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
    <div className="relative overflow-hidden border border-secondary/40 rounded-2xl bg-gradient-to-br from-secondary/20 via-secondary/5 to-tertiary/10 backdrop-blur-sm">
      {/* Decorative gradient */}
      <div className="absolute -inset-px bg-gradient-to-r from-secondary/20 via-transparent to-tertiary/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

      <div className="relative p-6 space-y-5">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-secondary/30 border border-secondary/50 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-secondary" />
          </div>
          <h3 className="text-xl font-bold font-headline text-secondary">Enroll User</h3>
        </div>

        {/* Name Input */}
        <div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter name"
            className="w-full px-4 py-3 rounded-xl bg-surface/80 border border-outline-variant/40 text-white placeholder:text-outline-variant focus:outline-none focus:border-secondary/60 focus:bg-surface/60 transition-all duration-300"
            disabled={loading}
          />
        </div>

        {/* Messages */}
        {error && (
          <div className="p-4 rounded-xl bg-error/20 border border-error/40 flex items-center gap-3 text-error text-sm font-label animate-pulse-once">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="p-4 rounded-xl bg-secondary/20 border border-secondary/40 text-secondary text-sm font-bold font-label">
            {success}
          </div>
        )}

        {/* Webcam Enrollment */}
        <button
          onClick={enrollViaWebcam}
          disabled={loading || !name.trim()}
          className="w-full px-4 py-3 rounded-xl font-bold font-label text-base transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
          style={{
            background: 'linear-gradient(135deg, #a1faff 0%, #00575b 100%)',
            color: '#0c0e12',
          }}
        >
          <div className="flex items-center justify-center gap-2">
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
            <span className="px-3 bg-surface/60 text-outline-variant">Or</span>
          </div>
        </div>

        {/* Photo Upload */}
        <div className="space-y-3">
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/bmp"
              onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
              disabled={loading}
              className="hidden"
            />
            <div className="flex items-center justify-center px-4 py-3 rounded-xl border-2 border-dashed border-outline-variant/40 hover:border-secondary/60 bg-surface/40 hover:bg-surface/60 transition-all duration-300 cursor-pointer">
              <div className="text-center">
                <Upload className="w-5 h-5 text-outline-variant mx-auto mb-2" />
                <p className="text-sm text-outline-variant font-label">
                  {photoFile ? photoFile.name : 'Click to upload photo'}
                </p>
              </div>
            </div>
          </label>

          <button
            onClick={enrollViaPhoto}
            disabled={loading || !name.trim() || !photoFile}
            className="w-full px-4 py-3 rounded-xl font-bold font-label text-base transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
            style={{
              background: 'linear-gradient(135deg, #c3f400 0%, #7d8a00 100%)',
              color: '#0c0e12',
            }}
          >
            <div className="flex items-center justify-center gap-2">
              <Upload className="w-5 h-5" />
              <span>{loading ? 'Processing...' : 'Upload & Enroll'}</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
