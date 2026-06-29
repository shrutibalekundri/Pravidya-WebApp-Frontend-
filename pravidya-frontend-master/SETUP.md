# Frontend Quick Setup Guide

## Prerequisites
- Node.js v16+ installed
- Backend server running on port 8000

## Installation Steps

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and verify:
   - `VITE_API_URL=http://localhost:8000/api`

3. **Start development server**
   ```bash
   npm run dev
   ```
   Frontend runs on `http://localhost:3000`

## Access Points

### Public
- **Admission Form**: `http://localhost:3000/`
- **Thank You Page**: `http://localhost:3000/thank-you`

### Admin
- **Login**: `http://localhost:3000/admin/login`
- **Dashboard**: `http://localhost:3000/admin/dashboard`
- **Default Credentials**: `admin` / `admin123`

### Counselor
- **Login**: `http://localhost:3000/counselor/login`
- **Dashboard**: `http://localhost:3000/counselor/dashboard`
- **Default Credentials**: `counselor1` / `counselor123`

## Features

✅ Public admission form with validation
✅ Admin dashboard with full control
✅ Counselor dashboard with limited access
✅ Role-based route protection
✅ Real-time data updates
✅ Responsive design
✅ Toast notifications
✅ Form validation

## Next Steps
- Test the admission form submission
- Login as admin and explore dashboard
- Login as counselor and view assigned leads
- Test automatic counselor assignment
