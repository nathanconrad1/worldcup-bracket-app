"use client";

import { useRef, type ReactNode } from "react";

// Horizontal scroll container with click-and-drag panning for mouse users.
// Touch devices already pan natively via overflow-x-auto, so we only wire up
// mouse dragging here. A drag that moves past a small threshold suppresses the
// click that would otherwise fire (so dragging never accidentally picks a team).
export default function DragScroll({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const state = useRef({ down: false, startX: 0, scrollLeft: 0, moved: false });

  function onMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    const el = ref.current;
    if (!el) return;
    state.current = { down: true, startX: e.pageX, scrollLeft: el.scrollLeft, moved: false };
  }

  function onMouseMove(e: React.MouseEvent) {
    const el = ref.current;
    const s = state.current;
    if (!s.down || !el) return;
    const dx = e.pageX - s.startX;
    if (Math.abs(dx) > 4) s.moved = true;
    el.scrollLeft = s.scrollLeft - dx;
  }

  function endDrag() {
    state.current.down = false;
  }

  // Capture phase: if we just dragged, eat the click before it reaches a button.
  function onClickCapture(e: React.MouseEvent) {
    if (state.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      state.current.moved = false;
    }
  }

  return (
    <div
      ref={ref}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
      onClickCapture={onClickCapture}
      className={`overflow-x-auto cursor-grab select-none active:cursor-grabbing ${className}`}
    >
      {children}
    </div>
  );
}
