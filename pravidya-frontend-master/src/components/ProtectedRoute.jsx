import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Debug helper
const debugAuth = () => {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  console.log('Auth Debug:', {
    token: token ? 'exists' : 'missing',
    user: userStr ? JSON.parse(userStr) : 'missing',
    userRole: userStr ? JSON.parse(userStr).role : 'N/A'
  });
};

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/pravidya/acme/veeman/login" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    // Debug logging
    console.error('Access Denied:', {
      allowedRoles,
      userRole: user?.role,
      user: user,
      isAuthenticated
    });
    debugAuth();
    
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-2">You don't have permission to access this page.</p>
          <p className="text-sm text-gray-500 mb-2">
            Required role: {allowedRoles.join(' or ')}
          </p>
          <p className="text-sm text-gray-500 mb-2">
            Your role: {user?.role || 'None'} | Authenticated: {isAuthenticated ? 'Yes' : 'No'}
          </p>
          <div className="flex gap-2 justify-center mt-4">
            <button
              onClick={() => {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/pravidya/acme/veeman/login';
              }}
              className="btn-primary"
            >
              Go to Login
            </button>
            <button
              onClick={() => {
                debugAuth();
                window.location.reload();
              }}
              className="btn-secondary"
            >
              Debug & Reload
            </button>
          </div>
        </div>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
