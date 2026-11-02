import { FormEvent, ReactNode, useEffect, useState } from 'react';

export default function AdminGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'logged-out' | 'logged-in'>('checking');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' })
      .then((res) => res.ok ? res.json() : { authenticated: false })
      .then((data) => { if (active) setStatus(data.authenticated ? 'logged-in' : 'logged-out'); })
      .catch(() => { if (active) setStatus('logged-out'); });
    return () => { active = false; };
  }, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) {
        setError(response.status === 429 ? 'Too many attempts. Try again later.' :
          response.status === 503 ? 'Admin login is not configured on the server.' : 'Invalid login credentials.');
        return;
      }
      setPassword('');
      setStatus('logged-in');
    } catch {
      setError('Unable to connect to the login server.');
    } finally {
      setSubmitting(false);
    }
  }

  if (status === 'checking') return <div className="min-h-screen flex items-center justify-center bg-background text-foreground">Checking session…</div>;
  if (status === 'logged-in') return <>{children}</>;

  return (
    <main className="min-h-screen flex items-center justify-center bg-background text-foreground p-5">
      <form onSubmit={login} className="w-full max-w-sm rounded-xl border border-border bg-card p-7 space-y-5">
        <div>
          <h1 className="text-2xl font-semibold">DSE Admin Login</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to access your market dashboard and trading controls.</p>
        </div>
        <label className="block text-sm">Login ID
          <input autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background p-3" />
        </label>
        <label className="block text-sm">Password
          <input type="password" autoComplete="current-password" required value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background p-3" />
        </label>
        {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
        <button disabled={submitting} type="submit"
          className="w-full rounded-md bg-primary px-4 py-3 font-medium text-primary-foreground disabled:opacity-50">
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
