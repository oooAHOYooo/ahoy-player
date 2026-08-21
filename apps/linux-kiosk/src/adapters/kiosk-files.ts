import type { FileImportAdapter, ImportCandidate } from "@ahoy/player-core";
import { BrowserFileImportAdapter } from "@ahoy/player-web-adapters";

declare global {
  interface Window {
    ahoyKiosk?: {
      chooseMp3Files(): Promise<ImportCandidate[]>;
    };
  }
}

/** A Linux launcher may inject a managed-folder bridge; browser preview uses a picker. */
export class KioskFileImportAdapter implements FileImportAdapter {
  readonly availability = "available" as const;
  private readonly browserFallback = new BrowserFileImportAdapter();

  chooseMp3Files(): Promise<ImportCandidate[]> {
    return window.ahoyKiosk?.chooseMp3Files() ?? this.browserFallback.chooseMp3Files();
  }
}
