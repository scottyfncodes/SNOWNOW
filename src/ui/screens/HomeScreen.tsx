import { Snowfall } from '@/ui/components/Snowfall';
import { Wordmark } from '@/ui/components/Wordmark';
import { OriginPicker } from '@/ui/components/OriginPicker';

export interface HomeScreenProps {
  originId: string;
  onOriginChange: (originId: string) => void;
  onNow: () => void;
  onLater: () => void;
  usingDemoData: boolean;
}

/**
 * Two choices. That's the whole homepage.
 *
 * NOW is decision mode — "I want to ski today". LATER is planning mode —
 * "what would my ski day look like on another date". Nothing else earns a
 * place above the fold, and no charts appear before the user has asked a
 * question.
 */
export function HomeScreen({
  originId,
  onOriginChange,
  onNow,
  onLater,
  usingDemoData,
}: HomeScreenProps) {
  return (
    <main className="home">
      <Snowfall density={38} />
      <div className="home-inner shell">
        <header className="home-head">
          <h1>
            <Wordmark />
            <span className="visually-hidden">SNOWNOW</span>
          </h1>
          <p className="home-tagline">Find your best mountain day.</p>
        </header>

        <div className="home-actions">
          <button type="button" className="bigbutton bigbutton-now" onClick={onNow}>
            <span className="bigbutton-word">NOW</span>
            <span className="bigbutton-sub">I want to ski today.</span>
          </button>
          <button type="button" className="bigbutton bigbutton-later" onClick={onLater}>
            <span className="bigbutton-word">LATER</span>
            <span className="bigbutton-sub">What would my ski day look like on another date?</span>
          </button>
        </div>

        <footer className="home-foot">
          <OriginPicker value={originId} onChange={onOriginChange} />
          {usingDemoData && (
            <p className="home-demo">
              <span className="chip chip-demo">DEMO DATA</span>
              <span>
                No live weather, traffic or lift feeds are connected. Every number below is
                simulated — and labelled as such.
              </span>
            </p>
          )}
        </footer>
      </div>
    </main>
  );
}
