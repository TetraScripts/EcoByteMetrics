import { useCallback, useEffect, useRef, useState } from "react";

export function HomeScrollbar() {
  const [thumbHeight, setThumbHeight] = useState(0);
  const [thumbTop, setThumbTop] = useState(0);
  const [isNearEdge, setIsNearEdge] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isScrollable, setIsScrollable] = useState(false);

  const isDraggingRef = useRef(false);
  const dragStartY = useRef(0);
  const dragStartScrollTop = useRef(0);

  const updateScroll = useCallback(() => {
    if (typeof window === "undefined") return;

    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = window.innerHeight;
    const maxScroll = scrollHeight - clientHeight;

    if (maxScroll <= 0) {
      setIsScrollable(false);
      return;
    }

    setIsScrollable(true);
    const calculatedHeight = Math.max((clientHeight / scrollHeight) * clientHeight, 44);
    setThumbHeight(calculatedHeight);

    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const progress = Math.min(Math.max(scrollTop / maxScroll, 0), 1);
    const availableTrack = clientHeight - calculatedHeight;
    setThumbTop(progress * availableTrack);
  }, []);

  useEffect(() => {
    document.documentElement.classList.add("has-custom-scrollbar");
    const rafId = requestAnimationFrame(updateScroll);

    const handleScroll = () => {
      updateScroll();
    };

    const handleMouseMove = (event: MouseEvent) => {
      // Ativa quando o cursor estiver a 36px ou menos da borda direita da janela
      const distanceFromRight = window.innerWidth - event.clientX;
      if (distanceFromRight <= 36) {
        setIsNearEdge(true);
      } else if (distanceFromRight > 48 && !isDraggingRef.current) {
        setIsNearEdge(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", updateScroll, { passive: true });
    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    return () => {
      cancelAnimationFrame(rafId);
      document.documentElement.classList.remove("has-custom-scrollbar");
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", updateScroll);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [updateScroll]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    isDraggingRef.current = true;
    setIsDragging(true);
    dragStartY.current = event.clientY;
    dragStartScrollTop.current = window.scrollY || document.documentElement.scrollTop;
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const deltaY = event.clientY - dragStartY.current;
    const clientHeight = window.innerHeight;
    const availableTrack = clientHeight - thumbHeight;
    if (availableTrack <= 0) return;

    const scrollHeight = document.documentElement.scrollHeight;
    const maxScroll = scrollHeight - clientHeight;
    const scrollDelta = (deltaY / availableTrack) * maxScroll;
    window.scrollTo({
      top: dragStartScrollTop.current + scrollDelta,
      behavior: "instant",
    });
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      setIsDragging(false);
      try {
        (event.target as HTMLElement).releasePointerCapture(event.pointerId);
      } catch {
        // Ignora se o ponteiro já foi liberado
      }
    }
  };

  const handleTrackClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    const trackRect = event.currentTarget.getBoundingClientRect();
    const clickY = event.clientY - trackRect.top;
    const clientHeight = window.innerHeight;
    const availableTrack = clientHeight - thumbHeight;
    if (availableTrack <= 0) return;

    const targetProgress = Math.min(Math.max((clickY - thumbHeight / 2) / availableTrack, 0), 1);
    const scrollHeight = document.documentElement.scrollHeight;
    const maxScroll = scrollHeight - clientHeight;
    window.scrollTo({
      top: targetProgress * maxScroll,
      behavior: "smooth",
    });
  };

  if (!isScrollable) return null;

  const isVisible = isNearEdge || isHovered || isDragging;

  return (
    <div
      className={`home-scrollbar-container ${isVisible ? "is-visible" : ""} ${
        isDragging ? "is-dragging" : ""
      }`.trim()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-hidden="true"
    >
      <div className="home-scrollbar-track" onClick={handleTrackClick}>
        <div
          className="home-scrollbar-thumb"
          style={{
            height: `${thumbHeight}px`,
            transform: `translate3d(0, ${thumbTop}px, 0)`,
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      </div>
    </div>
  );
}
