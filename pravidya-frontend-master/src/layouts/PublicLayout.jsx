import { Outlet } from 'react-router-dom';

const PublicLayout = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50/50 to-violet-50">
      <Outlet />
    </div>
  );
};

export default PublicLayout;
