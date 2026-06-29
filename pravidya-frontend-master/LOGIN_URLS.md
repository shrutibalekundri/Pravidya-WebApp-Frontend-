# Frontend Dashboard Login URLs

## Base URL
The frontend runs on:
- **Development**: `http://localhost:3000` (configured in vite.config.js)
- **Production**: Your deployed URL

**⚠️ Important**: The server must be running! Start it with `npm run dev` in the frontend directory.

---

## 🔐 Login Pages

### Admin Login
**URL**: `/admin/login`  
**Full URL**: `http://localhost:3000/admin/login`

**Default Credentials** (from seed data):
- **Username**: `admin`
- **Password**: `admin123`
- **Email**: `admin@admissions.com`

---

### Counselor Login
**URL**: `/counselor/login`  
**Full URL**: `http://localhost:3000/counselor/login`

**Default Credentials** (from seed data):
- **Username**: `counselor1`, `counselor2`, `counselor3`, or `counselor4`
- **Password**: `counselor123`
- **Emails**: 
  - `counselor1@admissions.com`
  - `counselor2@admissions.com`
  - `counselor3@admissions.com`
  - `counselor4@admissions.com`

---

## 📊 Admin Dashboard Routes

After logging in as Admin, you can access:

| Route | URL | Description |
|-------|-----|-------------|
| Dashboard | `/admin/dashboard` | Main admin dashboard with overview |
| Leads | `/admin/leads` | View and manage all leads |
| Counselors | `/admin/counselors` | Manage counselor profiles |
| Institutions | `/admin/institutions` | Manage institutions |
| Courses | `/admin/courses` | Manage courses |
| Training | `/admin/training` | Manage training content |
| Analytics | `/admin/analytics` | View analytics and reports |

**Full URLs** (assuming localhost:5173):
- `http://localhost:3000/admin/dashboard`
- `http://localhost:3000/admin/leads`
- `http://localhost:3000/admin/counselors`
- `http://localhost:3000/admin/institutions`
- `http://localhost:3000/admin/courses`
- `http://localhost:3000/admin/training`
- `http://localhost:3000/admin/analytics`

---

## 👨‍💼 Counselor Dashboard Routes

After logging in as Counselor, you can access:

| Route | URL | Description |
|-------|-----|-------------|
| Dashboard | `/counselor/dashboard` | Counselor dashboard with assigned leads |
| Leads | `/counselor/leads` | View assigned leads |
| Sessions | `/counselor/sessions` | Manage counseling sessions |
| Training | `/counselor/training` | Access training materials |
| Todos | `/counselor/todos` | Manage personal todos |

**Full URLs** (localhost:3000):
- `http://localhost:3000/counselor/dashboard`
- `http://localhost:3000/counselor/leads`
- `http://localhost:3000/counselor/sessions`
- `http://localhost:3000/counselor/training`
- `http://localhost:3000/counselor/todos`

---

## 🌐 Public Routes

| Route | URL | Description |
|-------|-----|-------------|
| Admission Form | `/` or `/admission` | Public admission form |
| Thank You | `/thank-you` | Confirmation page after submission |

**Full URLs**:
- `http://localhost:3000/`
- `http://localhost:3000/admission`
- `http://localhost:3000/thank-you`

---

## 🚀 Quick Start

1. **Start the frontend**:
   ```bash
   cd frontend
   npm run dev
   ```

2. **Access Admin Dashboard**:
   - Go to: `http://localhost:3000/admin/login`
   - Login with: `admin` / `admin123`

3. **Access Counselor Dashboard**:
   - Go to: `http://localhost:3000/counselor/login`
   - Login with: `counselor1` / `counselor123`

---

## 📝 Notes

- All dashboard routes are **protected** and require authentication
- Users are automatically redirected to their respective dashboards after login
- Admin users cannot access counselor routes and vice versa
- If not authenticated, users are redirected to the appropriate login page
- The base port may vary - check your terminal output when running `npm run dev`

---

## 🔄 Route Protection

- **Admin routes** (`/admin/*`): Only accessible by users with `ADMIN` role
- **Counselor routes** (`/counselor/*`): Only accessible by users with `COUNSELOR` role
- **Public routes**: Accessible to everyone

---

## 🎯 Direct Access URLs Summary

### Login Pages
```
http://localhost:3000/admin/login
http://localhost:3000/counselor/login
```

### Admin Dashboard Pages
```
http://localhost:3000/admin/dashboard
http://localhost:3000/admin/leads
http://localhost:3000/admin/counselors
http://localhost:3000/admin/institutions
http://localhost:3000/admin/courses
http://localhost:3000/admin/training
http://localhost:3000/admin/analytics
```

### Counselor Dashboard Pages
```
http://localhost:3000/counselor/dashboard
http://localhost:3000/counselor/leads
http://localhost:3000/counselor/sessions
http://localhost:3000/counselor/training
http://localhost:3000/counselor/todos
```

### Public Pages
```
http://localhost:3000/
http://localhost:3000/admission
http://localhost:3000/thank-you
```
