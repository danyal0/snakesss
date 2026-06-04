import React from 'react';
import { Outlet } from 'react-router-dom';
import { ConfirmProvider } from './context/ConfirmProvider';
import { useSocketListeners } from './hooks/useSocket';

export function RootLayout() {
  useSocketListeners();

  return (
    <ConfirmProvider>
      <div className="h-full w-full">
        <Outlet />
      </div>
    </ConfirmProvider>
  );
}
