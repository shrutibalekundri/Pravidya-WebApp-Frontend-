/**
 * Debug utility for authentication issues
 * Use this in browser console to check auth state
 */

export const debugAuth = () => {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  
  console.log('=== AUTH DEBUG ===');
  console.log('Token exists:', !!token);
  console.log('Token:', token ? token.substring(0, 20) + '...' : 'None');
  
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      console.log('User:', user);
      console.log('User Role:', user.role);
      console.log('User ID:', user.id);
      console.log('Is Admin:', user.role === 'ADMIN');
    } catch (e) {
      console.error('Failed to parse user:', e);
    }
  } else {
    console.log('No user in localStorage');
  }
  
  console.log('==================');
};

// Make it available globally for debugging
if (typeof window !== 'undefined') {
  window.debugAuth = debugAuth;
}
