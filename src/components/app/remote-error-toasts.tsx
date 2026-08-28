"use client";

import { useEffect } from "react";
import { subscribeRemoteErrors } from "@/lib/data/remote-store";
import { useToast } from "@/components/app/toast";

/**
 * Turns a failed background write into a toast.
 *
 * Renders nothing. It exists because the state layer, which fires the
 * writes, is mounted above the toast provider and cannot reach it directly.
 */
export function RemoteErrorToasts() {
  const { notify } = useToast();
  useEffect(() => {
    const unsubscribe = subscribeRemoteErrors((message) => notify(message, "warn"));
    return () => {
      unsubscribe();
    };
  }, [notify]);
  return null;
}
