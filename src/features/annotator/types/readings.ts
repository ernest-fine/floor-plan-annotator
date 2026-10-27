import type { ReadingUpdate } from "../domain/types";
export interface SignalReadingActions {
  add(gatewayId: string): void;
  update(index: number, patch: ReadingUpdate): void;
  remove(index: number): void;
}
