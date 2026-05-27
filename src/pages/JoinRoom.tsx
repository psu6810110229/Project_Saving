import { useSearchParams } from 'react-router-dom';
import { JoinRoomWizard } from '../components/JoinRoomWizard/JoinRoomWizard';
import { useRoom } from '../hooks/useRoom';

export function JoinRoom() {
  const [searchParams] = useSearchParams();
  const { activeRoom } = useRoom();

  const roomId = searchParams.get('roomId') ?? activeRoom?.id ?? '';
  const isRejoin = searchParams.get('rejoin') === 'true';
  const restoredBucketCount = Number(searchParams.get('buckets') || '0') || undefined;
  const roomGoalTarget = activeRoom?.target_amount ?? null;

  if (!roomId) return null;

  return (
    <JoinRoomWizard
      roomId={roomId}
      roomGoalTarget={roomGoalTarget}
      isRejoin={isRejoin}
      restoredBucketCount={restoredBucketCount}
    />
  );
}
