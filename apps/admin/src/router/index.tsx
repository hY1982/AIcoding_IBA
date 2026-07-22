import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import AdminLayout from '@/layouts/AdminLayout';
import { useAuth } from '@/hooks/useAuth';

// Lazy load pages for code splitting
const DashboardPage = React.lazy(() => import('@/pages/DashboardPage'));
const PlayerManagementPage = React.lazy(() => import('@/pages/PlayerManagementPage'));
const VenueManagementPage = React.lazy(() => import('@/pages/VenueManagementPage'));
const MatchManagementPage = React.lazy(() => import('@/pages/MatchManagementPage'));
const SystemParamsPage = React.lazy(() => import('@/pages/SystemParamsPage'));
const LoginPage = React.lazy(() => import('@/pages/LoginPage'));
const TestDashboardPage = React.lazy(() => import('@/pages/TestDashboardPage'));
const AcceptanceDemoPage = React.lazy(() => import('@/pages/AcceptanceDemoPage'));
const AbilityVerifierPage = React.lazy(() => import('@/pages/AbilityVerifierPage'));

/**
 * 路由守卫组件：未登录重定向到登录页
 */
const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <React.Suspense fallback={<div>加载中...</div>}>
        <LoginPage />
      </React.Suspense>
    ),
  },
  // 开发工具页面不需要登录
  {
    path: '/test-dashboard',
    element: (
      <React.Suspense fallback={<div>加载中...</div>}>
        <TestDashboardPage />
      </React.Suspense>
    ),
  },
  {
    path: '/acceptance-demo',
    element: (
      <React.Suspense fallback={<div>加载中...</div>}>
        <AcceptanceDemoPage />
      </React.Suspense>
    ),
  },
  {
    path: '/ability-verifier',
    element: (
      <React.Suspense fallback={<div>加载中...</div>}>
        <AbilityVerifierPage />
      </React.Suspense>
    ),
  },
  // 管理后台需要登录
  {
    path: '/',
    element: (
      <AuthGuard>
        <AdminLayout />
      </AuthGuard>
    ),
    children: [
      {
        index: true,
        element: (
          <React.Suspense fallback={<div>加载中...</div>}>
            <DashboardPage />
          </React.Suspense>
        ),
      },
      {
        path: 'players',
        element: (
          <React.Suspense fallback={<div>加载中...</div>}>
            <PlayerManagementPage />
          </React.Suspense>
        ),
      },
      {
        path: 'venues',
        element: (
          <React.Suspense fallback={<div>加载中...</div>}>
            <VenueManagementPage />
          </React.Suspense>
        ),
      },
      {
        path: 'matches',
        element: (
          <React.Suspense fallback={<div>加载中...</div>}>
            <MatchManagementPage />
          </React.Suspense>
        ),
      },
      {
        path: 'system-params',
        element: (
          <React.Suspense fallback={<div>加载中...</div>}>
            <SystemParamsPage />
          </React.Suspense>
        ),
      },
    ],
  },
]);
