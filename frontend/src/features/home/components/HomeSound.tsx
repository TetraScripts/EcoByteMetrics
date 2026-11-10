import { useEffect } from "react";
import { createHomeAudio } from "../domain/homeAudio";

export function HomeSound() {
  useEffect(() => {
    const player = createHomeAudio();
    const interact = (event: MouseEvent) => {
      if (!document.hidden && event.target instanceof Element && event.target.closest(".ecobyte-home") && event.target.closest("button, a, summary")) player.interact();
    };
    document.addEventListener("click", interact);
    return () => {
      document.removeEventListener("click", interact);
      player.dispose();
    };
  }, []);
  return null;
}
