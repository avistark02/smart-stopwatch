const API_BASE = '/api';

export interface Session {
  id: string;
  start_time: string;
  end_time: string;
  duration: number;
}

export interface AuthorizedUser {
  name: string;
}

export async function getSessionLog(): Promise<Session[]> {
  try {
    const res = await fetch(`${API_BASE}/session-log`);
    return await res.json();
  } catch (e) {
    console.error("Failed to fetch session log:", e);
    return [];
  }
}

export async function logSession(startTime: string, endTime: string) {
  // Backend handles logic automatically if using `status` updates!
  // This is kept here for manual sync if necessary, but backend already logs it on "active" -> "inactive" transition.
  console.log("Client noted session span:", startTime, endTime);
}

export async function clearSessionLog() {
  await fetch(`${API_BASE}/session-log`, { method: 'DELETE' });
}

export async function getAuthorizedUsers(): Promise<AuthorizedUser[]> {
  try {
    const res = await fetch(`${API_BASE}/authorized-users`);
    const arr = await res.json();
    // Python returns list of strings or list of objects
    if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === 'string') {
       return arr.map((name: string) => ({ name }));
    }
    return arr;
  } catch (e) {
    console.error("Failed to fetch authorized users:", e);
    return [];
  }
}

export async function enrollUser(_name: string, _descriptor: Float32Array) {
  // Enrollment is now handled via image POST in useFaceApi.ts, descriptor logic is deprecated.
  console.warn("enrollUser with descriptor deprecated in favor of WebRTC frame submission");
}

export async function removeUser(name: string) {
  await fetch(`${API_BASE}/remove-user`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
}
