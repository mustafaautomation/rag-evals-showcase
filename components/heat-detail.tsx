"use client";

import { useEffect, useState } from "react";

export function HeatDetail() {
  const [text, setText] = useState("Hover or focus a cell.");

  useEffect(() => {
    const read = (target: EventTarget | null) => {
      const element = (target as HTMLElement | null)?.closest?.("[data-heat-detail]");
      const detail = element?.getAttribute("data-heat-detail");
      if (detail) setText(detail);
    };
    const onPointer = (event: Event) => read(event.target);
    document.addEventListener("pointerover", onPointer);
    document.addEventListener("focusin", onPointer);
    return () => {
      document.removeEventListener("pointerover", onPointer);
      document.removeEventListener("focusin", onPointer);
    };
  }, []);

  return (
    <p className="heat-detail" data-testid="heat-detail" aria-live="polite">
      {text}
    </p>
  );
}
