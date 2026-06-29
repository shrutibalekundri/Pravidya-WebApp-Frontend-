import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Link } from 'react-router-dom';

const ManagementLogin = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState(null);
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (pendingRedirect && isAuthenticated) {
      navigate(pendingRedirect, { replace: true });
      setPendingRedirect(null);
    }
  }, [pendingRedirect, isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setPendingRedirect(null);
    try {
      const result = await login(username, password, 'MANAGEMENT');
      if (result.success && result.user?.role === 'MANAGEMENT') {
        setPendingRedirect('/management/overview');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="max-w-md w-full">
        <div className="card rounded-2xl shadow-soft-lg border-0">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Management Login</h1>
            <p className="text-gray-600">Sign in to access analytics</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username or Email</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="input-field" placeholder="Enter username or email" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input-field" placeholder="Enter password" required />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3 disabled:opacity-50">{loading ? 'Logging in...' : 'Login'}</button>
          </form>
          <div className="mt-6 text-center">
            <Link to="/" className="text-sm text-primary-600 hover:text-primary-700">Back</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManagementLogin;
