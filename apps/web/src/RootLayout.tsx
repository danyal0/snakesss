import React from 'react';
import { Outlet } from 'react-router-dom';
import { ConfirmProvider } from './context/ConfirmProvider';
import { VoiceProvider } from './context/VoiceProvider';
import { useSocketListeners } from './hooks/useSocket';

export function RootLayout() {
  useSocketListeners();

  return (
    <ConfirmProvider>
      <VoiceProvider>
        <div className="h-full w-full">
          <Outlet />
        </div>
      </VoiceProvider>
    </ConfirmProvider>
  );
}
