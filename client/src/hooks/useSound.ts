import { useCallback, useState } from "react";
import { soundEngine, type SoundName } from "../lib/sound";

export function useSound() {
  const [muted, setMutedState] = useState(soundEngine.muted);

  const toggleMuted = useCallback(() => {
    const next = !soundEngine.muted;
    soundEngine.setMuted(next);
    setMutedState(next);
  }, []);

  const play = useCallback((name: SoundName) => soundEngine.play(name), []);

  return { muted, toggleMuted, play };
}
