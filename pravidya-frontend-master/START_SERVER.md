# Starting the Frontend Server

## Quick Start

1. **Open a NEW PowerShell or Command Prompt window** (important for permissions)

2. **Navigate to frontend directory**:
   ```powershell
   cd C:\Users\aditi\OneDrive\Desktop\pravidya\pravidya\frontend
   ```

3. **Start the development server**:
   ```powershell
   npm run dev
   ```

4. **Wait for the server to start** - You should see output like:
   ```
   VITE v5.0.8  ready in 500 ms
   
   ➜  Local:   http://localhost:3000/
   ➜  Network: use --host to expose
   ```

5. **Access the admin login**:
   - Open browser and go to: `http://localhost:3000/admin/login`
   - Username: `admin`
   - Password: `admin123`

## Important Notes

- **Port**: The server runs on **port 3000** (not 5173) as configured in `vite.config.js`
- **Backend must be running**: Make sure the backend server is running on port 8000
- **Use a new terminal**: If you get permission errors, close the current terminal and open a fresh one

## Troubleshooting

### Error: "spawn EPERM" or Permission Denied

**Solution 1**: Close all terminals and open a NEW PowerShell window as Administrator:
1. Right-click PowerShell
2. Select "Run as Administrator"
3. Navigate to frontend directory
4. Run `npm run dev`

**Solution 2**: Clear esbuild cache:
```powershell
Remove-Item -Recurse -Force node_modules\.vite -ErrorAction SilentlyContinue
npm run dev
```

**Solution 3**: Reinstall dependencies:
```powershell
Remove-Item -Recurse -Force node_modules
npm install
npm run dev
```

### Port Already in Use

If port 3000 is already in use:
1. Find what's using it: `netstat -ano | findstr :3000`
2. Kill the process or change the port in `vite.config.js`

### Backend Not Running

Make sure the backend is running:
```powershell
cd C:\Users\aditi\OneDrive\Desktop\pravidya\pravidya\backend
npm start
```

## Correct URLs

Once the server is running on port 3000:

### Login Pages
- Admin: `http://localhost:3000/admin/login`
- Counselor: `http://localhost:3000/counselor/login`

### Admin Dashboard
- Dashboard: `http://localhost:3000/admin/dashboard`
- Leads: `http://localhost:3000/admin/leads`
- Counselors: `http://localhost:3000/admin/counselors`
- Institutions: `http://localhost:3000/admin/institutions`
- Courses: `http://localhost:3000/admin/courses`
- Training: `http://localhost:3000/admin/training`
- Analytics: `http://localhost:3000/admin/analytics`

### Counselor Dashboard
- Dashboard: `http://localhost:3000/counselor/dashboard`
- Leads: `http://localhost:3000/counselor/leads`
- Sessions: `http://localhost:3000/counselor/sessions`
- Training: `http://localhost:3000/counselor/training`
- Todos: `http://localhost:3000/counselor/todos`
