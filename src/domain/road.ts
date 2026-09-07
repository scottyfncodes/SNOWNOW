import type { RoadCondition } from './conditions';

/**
 * Road conditions are reported by *corridor* (I-70, US-40, ...), not by
 * mountain — a closure at the Eisenhower Tunnel affects every mountain behind
 * it at once, which is exactly why this is a separate authority from the
 * per-route `TravelCurve.roadCondition` a traffic provider infers from
 * inflated durations. A routing API can tell you a road is slow; it usually
 * cannot tell you *why*, or that it is closed outright. This is the source
 * that can.
 */
export interface RoadClosure {
  description: string;
  location: string;
  /** ISO 8601. */
  startedAt: string;
  /** ISO 8601, when known. */
  expectedClearBy?: string;
}

export interface RoadStatus {
  corridorId: string;
  condition: RoadCondition;
  closures: RoadClosure[];
  /** True traction-law / chain-law in effect, distinct from a generic "snow-packed" read. */
  tractionLawInEffect: boolean;
  /** When the source last updated this record, ISO 8601. */
  sourceTimestamp: string;
  source: string;
}

/** A corridor a closure or traction law makes impassable for the day. */
export const isImpassable = (status: RoadStatus): boolean => status.condition === 'closed';
