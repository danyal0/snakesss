import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLeaveRoom } from './useLeaveRoom';
import { useSocket } from './useSocket';
import { getRoomIdFromPath } from './useSession';
import { shouldConfirmRoomLeave } from '../utils/roomSession';
import { abandonRoom } from '../utils/abandonRoom';
import { clearActiveRoom } from '../utils/userProfile';
import { useGameStore } from '../store/gameStore';
import { setJoinInFlight } from '../utils/roomSession';

/** Leave room with correct confirmation rules (joined vs preview/joining). */
export function useRoomExit() {
  const navigate = useNavigate();
  const confirmLeaveRoom = useLeaveRoom();
  const { leaveRoom } = useSocket();

  return useCallback(() => {
    const roomId = getRoomIdFromPath();
    if (shouldConfirmRoomLeave()) {
      void confirmLeaveRoom(navigate);
      return;
    }
    setJoinInFlight(null);
    if (roomId) abandonRoom(roomId);
    clearActiveRoom();
    leaveRoom();
    navigate('/', { replace: true });
  }, [confirmLeaveRoom, leaveRoom, navigate]);
}
