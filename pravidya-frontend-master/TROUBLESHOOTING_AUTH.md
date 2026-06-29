# Troubleshooting "Access Denied" Error

## Quick Fix

If you're seeing "Access Denied" when trying to access the admin dashboard:

### Step 1: Clear Browser Storage
1. Open browser console (F12)
2. Run these commands:
   ```javascript
   localStorage.clear();
   sessionStorage.clear();
   location.reload();
   ```

### Step 2: Login Again
1. Go to: `http://localhost:3000/admin/login`
2. Use credentials:
   - Username: `admin`
   - Password: `admin123`
3. After login, you should be redirected to `/admin/dashboard`

## Common Causes

### 1. Stale Session
- **Solution**: Clear localStorage and login again

### 2. Role Mismatch
- **Check**: Open browser console and run:
  ```javascript
  console.log('User:', JSON.parse(localStorage.getItem('user')));
  console.log('Role:', JSON.parse(localStorage.getItem('user'))?.role);
  ```
- **Expected**: Should show `"ADMIN"`

### 3. Token Expired
- **Solution**: Login again to get a fresh token

### 4. Backend Not Running
- **Check**: Make sure backend is running on port 8000
- **Test**: Visit `http://localhost:8000/api/health`

## Debug Steps

1. **Check Authentication State**:
   ```javascript
   // In browser console
   const user = JSON.parse(localStorage.getItem('user'));
   console.log('User Role:', user?.role);
   console.log('Is Admin:', user?.role === 'ADMIN');
   ```

2. **Check Token**:
   ```javascript
   const token = localStorage.getItem('token');
   console.log('Token exists:', !!token);
   ```

3. **Clear and Re-login**:
   ```javascript
   localStorage.clear();
   window.location.href = '/admin/login';
   ```

## If Still Not Working

1. **Check Backend Logs**: Make sure backend is running and receiving requests
2. **Check Network Tab**: Look for failed API calls to `/api/auth/me`
3. **Verify Database**: Make sure admin user exists with role `ADMIN`
4. **Check Browser Console**: Look for any JavaScript errors

## Expected Behavior

After successful login:
- Token stored in `localStorage.token`
- User object stored in `localStorage.user`
- User object should have `role: "ADMIN"`
- Should redirect to `/admin/dashboard`
- ProtectedRoute should allow access
