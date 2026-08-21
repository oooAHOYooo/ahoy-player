import type { FileImportAdapter, ImportCandidate } from "@ahoy/player-core";
import { BrowserFileImportAdapter } from "@ahoy/player-web-adapters";

declare global {
  interface Window {
    ahoyDesktop?: {
      platform: string;
      chooseMp3Files(): Promise<ImportCandidate[]>;
      openDeck(): Promise<void>;
    };
  }
}

export class DesktopFileImportAdapter implements FileImportAdapter {
  readonly availability = "available" as const;
  private readonly browserFallback = new BrowserFileImportAdapter();

  chooseMp3Files(): Promise<ImportCandidate[]> {
    return window.ahoyDesktop?.chooseMp3Files() ?? this.browserFallback.chooseMp3Files();
  }
}
