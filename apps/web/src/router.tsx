import { createBrowserRouter, Navigate } from 'react-router-dom';
import { HomeScreen } from './screens/HomeScreen';
import { RoomScreen } from './screens/RoomScreen';
import { PublicRoomsScreen } from './screens/PublicRoomsScreen';
import { LeaderboardScreen } from './screens/LeaderboardScreen';
import { RootLayout } from './RootLayout';

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <HomeScreen /> },
      { path: '/room/:roomId', element: <RoomScreen /> },
      { path: '/rooms', element: <PublicRoomsScreen /> },
      { path: '/leaderboard', element: <LeaderboardScreen /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
