/**
 * Per-match statistics for the post-match summary — accumulated on the
 * presentation side from the same FrameEvents everything else reads
 * (components/frameEvents.ts), so the engine stays unaware of "stats".
 * Counts Leo's swings by resolved quality (PERFECT/GOOD/LATE connect,
 * MISS is a swing that didn't) and remembers the longest rally reached.
 */
import { readFrameEvents } from "@/components/frameEvents";
import type { GameSnapshot } from "@/game/types";

export interface MatchStats {
  perfect: number;
  good: number;
  late: number;
  miss: number;
  longestRally: number;
  /** Connected swings / all swings, in [0, 1]; 0 when Leo never swung. */
  accuracy: number;
}

export class MatchStatsTracker {
  private perfect = 0;
  private good = 0;
  private late = 0;
  private miss = 0;
  private longestRally = 0;

  update(prevSnapshot: GameSnapshot, nextSnapshot: GameSnapshot): void {
    const events = readFrameEvents(prevSnapshot, nextSnapshot);
    if (events.hit?.side === "leo") this[events.hit.quality] += 1;
    if (events.miss === "leo") this.miss += 1;
    this.longestRally = Math.max(this.longestRally, nextSnapshot.rally.count);
  }

  get(): MatchStats {
    const swings = this.perfect + this.good + this.late + this.miss;
    const connected = this.perfect + this.good + this.late;
    return {
      perfect: this.perfect,
      good: this.good,
      late: this.late,
      miss: this.miss,
      longestRally: this.longestRally,
      accuracy: swings === 0 ? 0 : connected / swings,
    };
  }
}
