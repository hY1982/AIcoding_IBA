import { createBrowserRouter } from 'react-router-dom';
import AdminLayout from '@/layouts/AdminLayout';

const DashboardPage = () => <div>Admin Dashboard</div>;

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AdminLayout />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
    ],
  },
]);
