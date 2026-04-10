export interface Session {
  id: string;
  startTime: string;
  endTime: string;
  duration: number;
}

export interface AuthorizedUser {
  name: string;
  descriptor: string; // Serialized Float32Array
}

export function getSessionLog(): Session[] {
  const data = localStorage.getItem('smart_stopwatch_sessions');
  return data ? JSON.parse(data) : [];
}

export function logSession(startTime: string, endTime: string) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const duration = Math.floor((end.getTime() - start.getTime()) / 1000);
  
  const entry: Session = {
    id: Math.random().toString(36).substring(2, 9),
    startTime,
    endTime,
    duration
  };

  const sessions = getSessionLog();
  sessions.push(entry);
  localStorage.setItem('smart_stopwatch_sessions', JSON.stringify(sessions));
}

export function clearSessionLog() {
  localStorage.removeItem('smart_stopwatch_sessions');
}

export function getAuthorizedUsers(): AuthorizedUser[] {
  const data = localStorage.getItem('smart_stopwatch_users');
  return data ? JSON.parse(data) : [];
}

export function enrollUser(name: string, descriptor: Float32Array) {
  const users = getAuthorizedUsers();
  users.push({
    name,
    descriptor: JSON.stringify(Array.from(descriptor))
  });
  localStorage.setItem('smart_stopwatch_users', JSON.stringify(users));
}

export function removeUser(name: string) {
  const users = getAuthorizedUsers().filter(u => u.name !== name);
  localStorage.setItem('smart_stopwatch_users', JSON.stringify(users));
}
