import { useState, useEffect } from 'react';
import { UserPlus, Trash2, Check, Shield } from 'lucide-react';
import EnrollmentForm from './EnrollmentForm';

interface User {
  name: string;
  has_thumbnail?: boolean;
  photo_url?: string;
}

interface Props {
  selectedPerson: string | null;
  onPersonSelected: (person: string | null) => void;
}

export default function UserManagement({ selectedPerson, onPersonSelected }: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/authorized-users');
      const data = await res.json();
      setUsers(Array.isArray(data) ? data.map((u: any) => (typeof u === 'string' ? { name: u } : u)) : []);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
    setLoading(false);
  };

  const loadSelectedUser = async () => {
    try {
      const res = await fetch('http://localhost:5000/selected-user');
      const data = await res.json();
      setSelected(data.selected || null);
    } catch (err) {
      console.error('Failed to load selected user:', err);
    }
  };

  const selectUser = async (name: string) => {
    try {
      const res = await fetch('http://localhost:5000/select-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (data.success) {
        setSelected(name);
        onPersonSelected(name);
      }
    } catch (err) {
      console.error('Failed to select user:', err);
    }
  };

  const removeUser = async (name: string) => {
    if (!confirm(`Remove ${name} from authorized users?`)) return;
    try {
      const res = await fetch('http://localhost:5000/remove-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (data.success) {
        setUsers(users.filter((u) => u.name !== name));
        if (selected === name) setSelected(null);
      }
    } catch (err) {
      console.error('Failed to remove user:', err);
    }
  };

  useEffect(() => {
    loadUsers();
    loadSelectedUser();
    const interval = setInterval(loadUsers, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      {/* Selected User Card */}
      <div className="relative overflow-hidden rounded-2xl p-4 border border-primary/40 bg-gradient-to-br from-primary/20 to-primary/10">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-transparent to-secondary/10 opacity-0 hover:opacity-50 transition-opacity duration-300"></div>
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/40 to-secondary/40 border border-primary/40 flex items-center justify-center flex-shrink-0">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-outline-variant font-label tracking-wider uppercase">Selected User</p>
            <p className="text-lg font-black text-primary font-headline">{selected || 'None'}</p>
          </div>
        </div>
      </div>

      {/* Users List */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-secondary/20 border border-secondary/40 flex items-center justify-center">
            <UserPlus className="w-5 h-5 text-secondary" />
          </div>
          <h3 className="text-xl font-bold font-headline text-secondary">Users ({users.length})</h3>
        </div>

        {users.length === 0 ? (
          <div className="p-6 text-center border border-outline-variant/30 rounded-2xl bg-surface-container/40 backdrop-blur-sm">
            <UserPlus className="w-8 h-8 text-outline-variant/40 mx-auto mb-3" />
            <p className="text-outline-variant font-label">No users enrolled yet</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
            {users.map((user) => (
              <div
                key={user.name}
                className={`group p-4 rounded-xl border transition-all duration-300 ${
                  selected === user.name
                    ? 'bg-gradient-to-r from-secondary/30 to-secondary/10 border-secondary/60 shadow-lg shadow-secondary/20'
                    : 'bg-surface-variant/40 border-outline-variant/40 hover:border-primary/60 hover:bg-surface-variant/60'
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-lg transition-all ${
                    selected === user.name
                      ? 'bg-gradient-to-br from-secondary to-primary border border-secondary/60'
                      : 'bg-gradient-to-br from-primary/40 to-secondary/40 border border-outline-variant/40'
                  }`}>
                    {user.name.charAt(0).toUpperCase()}
                  </div>

                  {/* User Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-primary font-headline capitalize">{user.name}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => selectUser(user.name)}
                      className={`p-2 rounded-lg transition-all duration-300 ${
                        selected === user.name
                          ? 'bg-secondary/40 text-surface scale-110'
                          : 'bg-primary/20 hover:bg-primary/40 text-primary'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => removeUser(user.name)}
                      className="p-2 rounded-lg bg-error/20 hover:bg-error/40 text-error transition-all duration-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Enrollment Form */}
      <EnrollmentForm onUserAdded={loadUsers} />
    </div>
  );
}
