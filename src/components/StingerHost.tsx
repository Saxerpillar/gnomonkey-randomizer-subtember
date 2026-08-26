import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Stinger, type StingerKind } from './Stinger';

/** How a stinger should behave, captured when it is queued. */
export interface StingerOptions {
  muted: boolean;
  /** Drop the white blowout; the art and the boom still play. */
  noFlash: boolean;
}

interface Queued extends StingerOptions {
  kind: StingerKind;
  id: number;
}

type Push = (kind: StingerKind, options: StingerOptions) => void;

const StingerContext = createContext<Push>(() => {});

/** Queue a stinger from anywhere below the provider. */
export const useStinger = (): Push => useContext(StingerContext);

/**
 * Owns the stinger queue and renders the playing one.
 *
 * It lives here, above the screens, for one reason: a stinger must never be cut
 * short. Rendered inside a screen it sat at a different tree position per phase,
 * so React unmounted it the moment the ceremony handed over to the result view
 * — killing the visual mid-flight while its sound carried on. Anchored above
 * every screen, its position never changes and it always plays out in full,
 * including when the viewer clicks to skip the reveal underneath.
 *
 * Stingers queue rather than replace: a flashbang on an elite landing and a
 * challenge slam moments later both get their moment, in order.
 */
export const StingerProvider = ({ children }: { children: ReactNode }) => {
  const [queue, setQueue] = useState<Queued[]>([]);
  const nextId = useRef(0);

  // Options are captured at queue time, so a stinger plays the way the run it
  // belongs to was configured even if the settings change while it waits.
  const push = useCallback<Push>((kind, options) => {
    setQueue((q) => [...q, { kind, id: ++nextId.current, ...options }]);
  }, []);

  const playing = queue[0];

  return (
    <StingerContext.Provider value={push}>
      {children}
      {playing && (
        <Stinger
          key={playing.id}
          kind={playing.kind}
          muted={playing.muted}
          noFlash={playing.noFlash}
          onDone={() => setQueue((q) => q.slice(1))}
        />
      )}
    </StingerContext.Provider>
  );
};
