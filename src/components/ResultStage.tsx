import type { CSSProperties } from 'react';
import { asset } from '../asset';
import { loadoutValue } from '../engine/roll';
import type { Loadout, Slot } from '../engine/types';
import { GpValue } from '../theme/GpValue';
import { GnomePeek } from '../theme/GnomePeek';
import { RsPanel } from '../theme/RsPanel';
import { BonusesPanel } from './BonusesPanel';
import { BossPanel, ChallengePanel } from './BossPanel';
import type { Challenge } from './challenges';
import type { Boss } from './DataProvider';
import { EquipmentPanel } from './EquipmentPanel';
import { bossObjective } from './objectives';

/**
 * The two-panel "final info" layout: your gear on the left, your challenger on
 * the right.
 *
 * Shared deliberately. The ceremony switches to this the moment the gear is
 * assembled, so the boss reveal card has a Challenger panel to fly into and the
 * handover to the committed result view is invisible — the frames, the gear and
 * the boss are already exactly where they will stay. Rendering a second, nearly
 * identical layout here would put a visible jump in the middle of the reveal.
 *
 * During the ceremony `boss` is null until it lands (`revealing` draws the "?"
 * suspense) and the challenge is withheld, so the only thing that appears on
 * commit is the challenge box.
 */
export const ResultStage = ({
  loadout,
  boss,
  hardMode = false,
  revealing = false,
  challenge = null,
  showChallenge = true,
  deactivated = false,
  onSlotContextMenu,
  style,
}: {
  loadout: Loadout;
  boss: Boss | null;
  hardMode?: boolean;
  /** Draw the boss stage's "?" placeholder — the reveal has not landed yet. */
  revealing?: boolean;
  challenge?: Challenge | null;
  /** Withheld mid-ceremony: the challenge is the one thing commit adds. */
  showChallenge?: boolean;
  /** Gauntlet runs take no gear in, so the skeleton stays powered down. */
  deactivated?: boolean;
  onSlotContextMenu?: (slot: Slot, e: React.MouseEvent) => void;
  style?: CSSProperties;
}) => {
  const value = loadoutValue(loadout);
  return (
    <main className="columns" style={style}>
      <RsPanel
        title="Your Gear"
        icon={asset('img/ui/multicombat.png')}
        decoration={<GnomePeek at="panelTopLeft" />}
      >
        <div className="gearStack">
          <div className="gearRow">
            <EquipmentPanel
              loadout={loadout}
              onSlotContextMenu={onSlotContextMenu ?? (() => {})}
              deactivated={deactivated}
            />
            <BonusesPanel loadout={loadout} />
          </div>
          <div className="value">
            Loadout value: <GpValue gp={value} />
          </div>
        </div>
      </RsPanel>
      <RsPanel
        title="Your Challenger"
        icon={asset('img/ui/skull.png')}
        decoration={<GnomePeek at="panelBottomRight" />}
      >
        <div className="fate">
          <BossPanel
            boss={boss}
            revealing={revealing}
            hardMode={hardMode}
            objective={boss ? bossObjective(boss.name, value) : null}
          />
          {showChallenge && <ChallengePanel challenge={challenge} />}
        </div>
      </RsPanel>
    </main>
  );
};
