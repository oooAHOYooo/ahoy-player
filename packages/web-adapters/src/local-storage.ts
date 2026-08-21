import type { PersistenceAdapter, PlayerSnapshot } from "@ahoy/player-core";

export class LocalStoragePersistenceAdapter implements PersistenceAdapter {
  private readonly channel?: BroadcastChannel;

  constructor(private readonly key = "ahoy-player:snapshot:v1") {
    if (typeof globalThis.BroadcastChannel === "function") {
      this.channel = new BroadcastChannel(`${key}:window-sync`);
    }
  }

  async load(): Promise<PlayerSnapshot | undefined> {
    const raw = globalThis.localStorage?.getItem(this.key);
    if (!raw) return undefined;
    try {
      const parsed = JSON.parse(raw) as PlayerSnapshot;
      return parsed.version === 1 && parsed.library?.schemaVersion === 1 ? parsed : undefined;
    } catch {
      return undefined;
    }
  }

  async save(snapshot: PlayerSnapshot): Promise<void> {
    globalThis.localStorage?.setItem(this.key, JSON.stringify(snapshot));
    this.channel?.postMessage(snapshot);
  }

  async clear(): Promise<void> {
    globalThis.localStorage?.removeItem(this.key);
  }

  subscribe(listener: (snapshot: PlayerSnapshot) => void): () => void {
    if (this.channel) {
      const onMessage = (event: MessageEvent<PlayerSnapshot>) => {
        if (isSnapshot(event.data)) listener(event.data);
      };
      this.channel.addEventListener("message", onMessage);
      return () => this.channel?.removeEventListener("message", onMessage);
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key !== this.key || !event.newValue) return;
      try {
        const snapshot = JSON.parse(event.newValue) as PlayerSnapshot;
        if (isSnapshot(snapshot)) listener(snapshot);
      } catch {
        // Ignore malformed writes from older or unrelated clients.
      }
    };
    globalThis.addEventListener?.("storage", onStorage as EventListener);
    return () => globalThis.removeEventListener?.("storage", onStorage as EventListener);
  }
}

function isSnapshot(value: unknown): value is PlayerSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as PlayerSnapshot;
  return snapshot.version === 1 && snapshot.library?.schemaVersion === 1;
}
