import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { HomeScreen } from './screens/HomeScreen';
import { RoomScreen } from './screens/RoomScreen';
import { PublicRoomsScreen } from './screens/PublicRoomsScreen';
import { LeaderboardScreen } from './screens/LeaderboardScreen';
import { useSocketListeners } from './hooks/useSocket';

export default function App() {
  // Register ALL socket listeners exactly once here — never in child components
  useSocketListeners();

  return (
    <div className="h-full w-full">
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/room/:roomId" element={<RoomScreen />} />
        <Route path="/rooms" element={<PublicRoomsScreen />} />
        <Route path="/leaderboard" element={<LeaderboardScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
