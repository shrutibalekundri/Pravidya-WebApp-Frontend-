import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    // On mount, check localStorage for existing auth
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (storedToken) {
      // Restore token from localStorage
      if (!token) {
        setToken(storedToken);
      }
      
      // Restore user from localStorage temporarily while fetching
      if (storedUser && !user) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
        } catch (e) {
          console.error('Failed to parse stored user:', e);
          localStorage.removeItem('user');
        }
      }
      
      // Fetch fresh user data
      fetchUser();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  const fetchUser = async () => {
    try {
      const response = await authAPI.getMe();
      const userData = response.data.data.user;
      setUser(userData);
      // Update localStorage with fresh user data
      localStorage.setItem('user', JSON.stringify(userData));
    } catch (error) {
      console.error('Failed to fetch user:', error);
      // If fetch fails, try to use stored user temporarily
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
        } catch (e) {
          console.error('Failed to parse stored user:', e);
          logout();
        }
      } else {
        logout();
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password, role = null) => {
    try {
      const response = await authAPI.login(username, password, role);
      
      // Validate response structure
      if (!response || !response.data) {
        console.error('Invalid response structure:', response);
        throw new Error('Invalid response from server');
      }
      
      // Check if response has data property
      const responseData = response.data.data || response.data;
      
      if (!responseData) {
        console.error('Missing data in response:', response.data);
        throw new Error('Invalid response: missing data');
      }
      
      // Safely destructure with defaults
      const newToken = responseData.token;
      const userData = responseData.user;
      
      // Validate required fields
      if (!newToken) {
        console.error('Missing token in response:', responseData);
        throw new Error('Invalid response: missing authentication token');
      }
      
      if (!userData) {
        console.error('Missing user data in response:', responseData);
        throw new Error('Invalid response: missing user data');
      }
      
      setToken(newToken);
      setUser(userData);
      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(userData));
      
      toast.success('Login successful!');
      return { success: true, user: userData };
    } catch (error) {
      console.error('Login error:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        stack: error.stack
      });
      
      let message = error.response?.data?.message || error.message || 'Login failed. Please check your credentials.';
      if (error.code === 'ECONNABORTED') {
        message = 'Login timed out. Please check that the server is running and try again.';
      } else if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
        message = 'Cannot reach server. Please ensure the backend is running (e.g. on port 8000) and try again.';
      } else if (error.response?.status === 404) {
        message = 'Login endpoint not found. Please restart the backend server and try again.';
      }
      toast.error(message);
      return { success: false, error: message };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    toast.success('Logged out successfully');
  };

  const isAdmin = () => user?.role === 'ADMIN';
  const isCounselor = () => user?.role === 'COUNSELOR';

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    isAdmin,
    isCounselor,
    isAuthenticated: !!token && !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
