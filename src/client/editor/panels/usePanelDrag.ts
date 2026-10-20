import { useCallback, useEffect, useRef } from "react";
import type { DragInsert } from "../store.js";
import { useStore } from "../context.js";
import { dragBridge } from "../dragBridge.js";

/** Pointer-based drag from a panel item onto the canvas. Click (no movement) runs `onClick` instead. */
export function usePanelDrag() {
  const store = useStore();
  const state = useRef<{ x: number; y: number; insert: DragInsert; onClick: () => void; moved: boolean } | null>(null);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const s = state.current;
      if (!s) return;
      if (!s.moved && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 5) {
        s.moved = true;
        store.setDragInsert(s.insert);
      }
      if (s.moved) dragBridge.hover?.(e.clientX, e.clientY);
    };
    const up = (e: PointerEvent) => {
      const s = state.current;
      state.current = null;
      if (!s) return;
      if (s.moved) {
        const dropped = dragBridge.drop?.(e.clientX, e.clientY) ?? false;
        store.setDragInsert(null);
        if (!dropped) dragBridge.cancel?.();
      } else s.onClick();
    };
    const cancel = () => {
      state.current = null;
      store.setDragInsert(null);
      dragBridge.cancel?.();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
  }, [store]);

  return useCallback((e: React.PointerEvent, insert: DragInsert, onClick: () => void) => {
    if (e.button !== 0) return;
    state.current = { x: e.clientX, y: e.clientY, insert, onClick, moved: false };
  }, []);
}
