import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import { router } from './router';
import ErrorBoundary from './components/ErrorBoundary';

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ConfigProvider>
        <RouterProvider router={router} />
      </ConfigProvider>
    </ErrorBoundary>
  );
};

export default App;
