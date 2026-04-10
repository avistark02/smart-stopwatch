import { useState, useEffect } from 'react';
import { UserPlus, Trash2, Check, Shield } from 'lucide-react';
import EnrollmentForm from './EnrollmentForm';
import { getAuthorizedUsers, removeUser, AuthorizedUser } from '../lib/storage';

interface Props {
  selectedPerson: string | null;
  onPersonSelected: (person: string | null) => void;
  enrollFace: (name: string) => Promise<boolean>;
  isCameraReady: boolean;
}

export default function UserManagement({ selectedPerson, onPersonSelected, enrollFace, isCameraReady }: Props) {
  const [users, setUsers] = useState<AuthorizedUser[]>([]);

  const loadUsers = async () => {
    const loaded = await getAuthorizedUsers();
    setUsers(loaded);
  };

  const handleRemoveUser = async (name: string) => {
    if (!confirm(`Remove ${name} from authorized users?`)) return;
    await removeUser(name);
    await loadUsers();
    if (selectedPerson === name) onPersonSelected(null);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  return (
    <div className="space-y-6 fade-in-up delay-2">
      <div className="relative overflow-hidden rounded-3xl p-6 border border-primary/40 bg-gradient-to-br from-primary/20 to-primary/10 hover:border-primary/60 transition-all duration-300 hover-lift">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-transparent to-secondary/10 opacity-0 hover:opacity-40 transition-opacity duration-300"></div>
        <div className="absolute inset-0 shimmer opacity-0 hover:opacity-30 transition-opacity duration-500"></div>
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/40 to-secondary/40 border border-primary/40 flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary/20">
            <Shield className="w-7 h-7 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-outline-variant font-label tracking-widest uppercase">Selected User</p>
            <p className="text-xl font-black text-primary font-headline mt-1">{selectedPerson || 'None'}</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-secondary/30 to-secondary/10 border border-secondary/40 flex items-center justify-center hover:border-secondary/60 transition-colors">
            <UserPlus className="w-5 h-5 text-secondary" />
          </div>
          <h3 className="text-xl font-bold font-headline text-secondary">Users ({users.length})</h3>
        </div>

        {users.length === 0 ? (
          <div className="p-8 text-center border border-outline-variant/30 rounded-3xl bg-surface-container/40 backdrop-blur-sm hover:border-primary/40 transition-all">
            <div className="animate-pulse opacity-60 inline-block mb-3">
              <UserPlus className="w-8 h-8 text-outline-variant/40" />
            </div>
            <p className="text-outline-variant font-label">No users enrolled yet</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
            {users.map((user, idx) => (
              <div
                key={user.name}
                className={`group p-5 rounded-2xl border transition-all duration-300 fade-in-up ${
                  selectedPerson === user.name
                    ? 'bg-gradient-to-r from-secondary/30 via-secondary/20 to-secondary/10 border-secondary/60 shadow-xl shadow-secondary/30'
                    : 'bg-surface-variant/40 border-outline-variant/40 hover:border-primary/60 hover:bg-surface-variant/60 hover:shadow-lg hover:shadow-primary/10'
                }`}
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-lg transition-all duration-300 ${
                    selectedPerson === user.name
                      ? 'bg-gradient-to-br from-secondary to-primary border border-secondary/60 shadow-lg shadow-secondary/30'
                      : 'bg-gradient-to-br from-primary/40 to-secondary/40 border border-outline-variant/40 group-hover:border-primary/60 group-hover:shadow-lg group-hover:shadow-primary/20'
                  }`}>
                    {user.name.charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-primary font-headline capitalize group-hover:text-secondary transition-colors">{user.name}</p>
                  </div>

                  <div className="flex gap-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <button
                      onClick={() => onPersonSelected(user.name)}
                      className={`p-2.5 rounded-lg transition-all duration-300 ${
                        selectedPerson === user.name
                          ? 'bg-secondary/40 text-surface scale-110 shadow-lg shadow-secondary/30'
                          : 'bg-primary/20 hover:bg-primary/40 text-primary hover:shadow-lg hover:shadow-primary/20'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleRemoveUser(user.name)}
                      className="p-2.5 rounded-lg bg-error/20 hover:bg-error/40 text-error transition-all duration-300 hover:shadow-lg hover:shadow-error/20"
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

      <EnrollmentForm onUserAdded={loadUsers} enrollFace={enrollFace} isCameraReady={isCameraReady} />
    </div>
  );
}
