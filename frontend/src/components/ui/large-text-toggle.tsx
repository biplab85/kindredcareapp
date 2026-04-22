"use client";

import { useSyncExternalStore, useCallback } from "react";
import { ALargeSmall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getSnapshot() {
  return localStorage.getItem("kindredcare-large-text") === "true";
}

function getServerSnapshot() {
  return false;
}

export function LargeTextToggle() {
  const isLarge = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback(() => {
    const next = !isLarge;
    localStorage.setItem("kindredcare-large-text", String(next));
    if (next) {
      document.documentElement.classList.add("large-text");
    } else {
      document.documentElement.classList.remove("large-text");
    }
    window.dispatchEvent(new StorageEvent("storage"));
  }, [isLarge]);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant={isLarge ? "secondary" : "ghost"}
            size="icon"
            onClick={toggle}
            aria-label={isLarge ? "Switch to normal text size" : "Switch to large text size"}
            aria-pressed={isLarge}
          >
            <ALargeSmall className="size-5" />
          </Button>
        }
      />
      <TooltipContent>{isLarge ? "Normal text" : "Large text"}</TooltipContent>
    </Tooltip>
  );
}
