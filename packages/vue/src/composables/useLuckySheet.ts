import { inject, type InjectionKey, type ShallowRef } from "vue";
import type { WorkbookEngine } from "@luckysheet3/core";

export const LUCKY_ENGINE_KEY: InjectionKey<ShallowRef<WorkbookEngine | null>> =
  Symbol("luckysheet3-engine");

export function useLuckySheet(): WorkbookEngine {
  const engineRef = inject(LUCKY_ENGINE_KEY);
  if (!engineRef?.value) {
    throw new Error("useLuckySheet() must be used inside <LuckySheet>");
  }
  return engineRef.value;
}

export function useLuckySheetOptional(): WorkbookEngine | null {
  return inject(LUCKY_ENGINE_KEY)?.value ?? null;
}
