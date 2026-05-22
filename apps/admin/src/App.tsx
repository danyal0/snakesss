import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAdminStore } from './store/adminStore';
import { LoginScreen } from './screens/LoginScreen';
import { DashboardScreen } from './screens/DashboardScreen';

export default function App() {
  const isAuthenticated = useAdminStore((s) => s.isAuthenticated);

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <div className="h-full w-full">
      <Routes>
        <Route path="/dashboard/*" element={<DashboardScreen />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </div>
  );
}
