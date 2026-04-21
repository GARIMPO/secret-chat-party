// Lightweight notification + app badge helpers.
// Works on Android/Chrome/Desktop. Silently no-ops where unsupported (iOS Safari).

let unreadCount = 0;

export function isTabVisible(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "visible";
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  if (Notification.permission === "default") {
    try {
      return await Notification.requestPermission();
    } catch {
      return "denied";
    }
  }
  return Notification.permission;
}

export function setBadge(count: number) {
  unreadCount = Math.max(0, count);
  const nav = navigator as Navigator & {
    setAppBadge?: (n?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  try {
    if (unreadCount > 0 && nav.setAppBadge) {
      nav.setAppBadge(unreadCount).catch(() => {});
    } else if (nav.clearAppBadge) {
      nav.clearAppBadge().catch(() => {});
    }
  } catch {
    // unsupported (iOS Safari) — ignore
  }
  // Update document title as a universal fallback
  if (typeof document !== "undefined") {
    const base = document.title.replace(/^\(\d+\)\s*/, "");
    document.title = unreadCount > 0 ? `(${unreadCount}) ${base}` : base;
  }
}

export function incrementBadge() {
  setBadge(unreadCount + 1);
}

export function clearBadge() {
  setBadge(0);
}

export function showMessageNotification(title: string, body: string, tag = "chat-message") {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (isTabVisible()) return; // don't spam when user is looking at the tab
  try {
    const n = new Notification(title, {
      body,
      tag,
      icon: "/favicon.png",
      badge: "/favicon.png",
      silent: false,
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // ignore
  }
}
