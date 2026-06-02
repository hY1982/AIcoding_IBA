import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import AdminLayout from '@/layouts/AdminLayout';

const DashboardPage = () => <div>Admin Dashboard</div>;
const TestDashboardPage = React.lazy(() => import('@/pages/TestDashboardPage'));
const AcceptanceDemoPage = React.lazy(() => import('@/pages/AcceptanceDemoPage'));

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AdminLayout />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: 'test-dashboard',
        element: (
          <React.Suspense fallback={<div>加载中...</div>}>
            <TestDashboardPage />
          </React.Suspense>
        ),
      },
      {
        path: 'acceptance-demo',
        element: (
          <React.Suspense fallback={<div>加载中...</div>}>
            <AcceptanceDemoPage />
          </React.Suspense>
        ),
      },
    ],
  },
]);
