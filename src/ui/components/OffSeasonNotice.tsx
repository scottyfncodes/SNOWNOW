import type { OffSeasonMessage } from '@/domain/mountainStatus';

/**
 * Stands in for the verdict/timing block when a normal ski recommendation
 * would be dishonest — off-season, no snow, insufficient coverage, closed, or
 * an outright unknown. The joke is the hook; `detail` is the part that has to
 * be true, and it's built from the same real weather/ops data as everything
 * else on the card (see `engine/offSeasonMessages.ts`).
 */
export function OffSeasonNotice({ message }: { message: OffSeasonMessage }) {
  return (
    <div className="offseason" role="status">
      <p className="offseason-line">{message.line}</p>
      <p className="offseason-detail">{message.detail}</p>
    </div>
  );
}
