/**
 * Jitsi Meet's IFrame API, loaded once from the public server. Browser only:
 * the loader touches `document`, so it runs from a click, never at render.
 * https://jitsi.github.io/handbook/docs/dev-guide/dev-guide-iframe
 */
import { VIDEO_DOMAIN } from "@/lib/meetings/video";

export interface JitsiMeetApi {
  executeCommand(command: "toggleAudio" | "toggleVideo" | "hangup"): void;
  addEventListener(event: string, listener: (payload: { muted?: boolean }) => void): void;
  removeEventListener(event: string, listener: (payload: { muted?: boolean }) => void): void;
  isAudioMuted(): Promise<boolean>;
  isVideoMuted(): Promise<boolean>;
  dispose(): void;
}

export interface JitsiMeetOptions {
  roomName: string;
  parentNode: HTMLElement;
  width?: string | number;
  height?: string | number;
  userInfo?: { displayName?: string };
  configOverwrite?: Record<string, unknown>;
  interfaceConfigOverwrite?: Record<string, unknown>;
}

export type JitsiMeetCtor = new (domain: string, options: JitsiMeetOptions) => JitsiMeetApi;

declare global {
  interface Window {
    JitsiMeetExternalAPI?: JitsiMeetCtor;
  }
}

export const JITSI_SCRIPT_URL = `https://${VIDEO_DOMAIN}/external_api.js`;

let pending: Promise<JitsiMeetCtor> | null = null;

/** The API constructor, fetching the script on first call. A failed load is forgotten so a retry can fetch again. */
export function loadJitsi(): Promise<JitsiMeetCtor> {
  if (typeof window === "undefined") return Promise.reject(new Error("Jitsi needs a browser"));
  if (window.JitsiMeetExternalAPI) return Promise.resolve(window.JitsiMeetExternalAPI);
  if (pending) return pending;
  pending = new Promise<JitsiMeetCtor>((resolve, reject) => {
    const fail = () => {
      pending = null;
      reject(new Error("Could not load Jitsi Meet"));
    };
    const script = document.createElement("script");
    script.src = JITSI_SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      if (window.JitsiMeetExternalAPI) resolve(window.JitsiMeetExternalAPI);
      else fail();
    };
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return pending;
}
