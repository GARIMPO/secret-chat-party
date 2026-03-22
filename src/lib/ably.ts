import Ably from "ably";

// Replace with your Ably API key from https://ably.com/dashboard
const ABLY_API_KEY = "LRk72A.mvBoUw:24WIMiGh9X_3UcW9gfJrZ45nEG71ArcuUE3IbPUhRTE";

let client: Ably.Realtime | null = null;

export function getAblyClient(clientId: string): Ably.Realtime {
  if (!client) {
    client = new Ably.Realtime({
      key: ABLY_API_KEY,
      clientId,
    });
  }
  return client;
}
