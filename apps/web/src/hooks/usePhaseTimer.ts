import { useState, useEffect } from 'react';

export function usePhaseTimer(endsAt: number | null): {
  secondsLeft: number;
  progress: number;
  isUrgent: boolean;
} {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [progress, setProgress] = useState(1);

  useEffect(() => {
    if (!endsAt) {
      setSecondsLeft(0);
      setProgress(1);
      return;
    }

    const totalDuration = endsAt - Date.now();

    const update = () => {
      const remaining = endsAt - Date.now();
      const secs = Math.max(0, Math.ceil(remaining / 1000));
      const prog = Math.max(0, remaining / totalDuration);
      setSecondsLeft(secs);
      setProgress(prog);
    };

    update();
    const id = setInterval(update, 100);
    return () => clearInterval(id);
  }, [endsAt]);

  return {
    secondsLeft,
    progress,
    isUrgent: secondsLeft <= 10 && secondsLeft > 0,
  };
}
