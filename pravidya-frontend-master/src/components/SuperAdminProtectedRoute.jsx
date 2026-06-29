import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const SuperAdminProtectedRoute = ({ children }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/super-admin/login" replace />;
  }

  if (user?.role !== 'SUPER_ADMIN') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-2">Super Admin access required.</p>
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              window.location.href = '/super-admin/login';
            }}
            className="btn-primary mt-4"
          >
            Go to Super Admin Login
          </button>
        </div>
      </div>
    );
  }

  return children;
};

export default SuperAdminProtectedRoute;
