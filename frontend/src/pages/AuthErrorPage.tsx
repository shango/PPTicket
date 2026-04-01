import { useSearchParams, Link } from 'react-router-dom';

const errorMessages: Record<string, string> = {
  domain: 'This app is only available to PDO Experts team members.',
  token_exchange: 'Authentication failed. Please try again.',
  userinfo: 'Could not retrieve your account information. Please try again.',
  no_code: 'Authentication was cancelled or failed.',
};

export function AuthErrorPage() {
  const [params] = useSearchParams();
  const reason = params.get('reason') || 'unknown';
  const message = errorMessages[reason] || 'An unknown error occurred during sign in.';

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base">
      <div className="text-center max-w-md">
        <div className="w-12 h-12 rounded-full bg-p0/20 text-p0 flex items-center justify-center mx-auto mb-4 text-xl">
          !
        </div>
        <h1 className="text-xl font-semibold mb-2">Sign In Error</h1>
        <p className="text-text-muted mb-6">{message}</p>
        <Link
          to="/login"
          className="inline-block px-4 py-2 bg-accent text-white rounded text-sm hover:bg-accent/90 transition-colors"
        >
          Back to Sign In
        </Link>
      </div>
    </div>
  );
}
