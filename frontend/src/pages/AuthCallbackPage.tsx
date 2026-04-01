import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { setToken } from '../lib/api';
import { useStore } from '../lib/store';

export function AuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const fetchUser = useStore((s) => s.fetchUser);

  useEffect(() => {
    const token = params.get('token');
    const redirect = params.get('redirect') || '/board';

    if (token) {
      setToken(token);
      fetchUser().then(() => navigate(redirect, { replace: true }));
    } else {
      navigate('/login', { replace: true });
    }
  }, [params, navigate, fetchUser]);

  return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-text-muted">Signing in...</p>
    </div>
  );
}
