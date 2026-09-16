import { useEffect, useState } from "react";
import { useBlocker } from "@tanstack/react-router";

/**
 * Returns true when the leave-confirmation guard should be active.
 *
 * Disabled by default in dev (annoying during HMR / iteration) and when the
 * VITE_WIZARD_DISABLE_LEAVE_GUARD env var is set to "true" (useful for e2e).
 */
function isGuardEnabled(): boolean {
  if (import.meta.env.DEV) return false;
  if (import.meta.env.VITE_WIZARD_DISABLE_LEAVE_GUARD === "true") return false;
  return true;
}

export type UnsavedChangesGuard = {
  /** True when a navigation attempt is currently paused, awaiting user choice. */
  isOpen: boolean;
  /** Resolve the paused navigation — let it proceed. */
  confirm: () => void;
  /** Resolve the paused navigation — cancel it, stay on the page. */
  cancel: () => void;
};

/**
 * Intercepts router navigations and browser unloads while `when` is true.
 *
 * The hook returns a control surface; the consumer renders its own dialog so
 * copy, styling, and side effects (e.g. clearing sessionStorage) stay in the
 * caller. See WizardRunner for the wired-up dialog.
 */
export function useUnsavedChangesGuard(when: boolean): UnsavedChangesGuard {
  const active = when && isGuardEnabled();
  const [isOpen, setIsOpen] = useState(false);

  const blocker = useBlocker({
    shouldBlockFn: () => active,
    enableBeforeUnload: () => active,
    withResolver: true,
  });

  // Surface the paused intent to the consumer when the router pauses navigation.
  useEffect(() => {
    if (blocker.status === "blocked") setIsOpen(true);
  }, [blocker.status]);

  return {
    isOpen,
    confirm: () => {
      setIsOpen(false);
      if (blocker.status === "blocked") blocker.proceed();
    },
    cancel: () => {
      setIsOpen(false);
      if (blocker.status === "blocked") blocker.reset();
    },
  };
}
