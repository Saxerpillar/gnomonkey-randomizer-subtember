import { Fragment, useEffect, useState } from 'react';
import { asset } from '../asset';
import { GpValue } from '../theme/GpValue';
import { RsButton } from '../theme/RsButton';
import { RsPanel } from '../theme/RsPanel';
import { tally, type HistoryEntry, type Outcome } from './history';
import { nuzlockeLabel } from './nuzlocke';
import styles from './HistoryPanel.module.css';

const when = (at: number): string => {
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Runs per page, sized to the window: 8 on a tall screen down to 5 on a short
 *  one, so a page never spills past the fold. */
const pageSizeFor = (): number =>
  Math.min(8, Math.max(5, Math.round(window.innerHeight / 150)));

const TrashIcon = () => (
  <svg className={styles.trashIcon} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M9 3h6l1 2h4v2H4V5h4l1-2zM6 9h12l-1 12H7L6 9z" />
  </svg>
);

/**
 * One nuzlocke group's header. A badge showing the run's name; clicking it
 * expands to reveal the first boss roll date and a rename field.
 */
const NuzlockeGroup = ({
  id,
  name,
  firstAt,
  onRename,
}: {
  id: string;
  name: string;
  firstAt: number;
  onRename: (id: string, name: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(name);
  useEffect(() => setDraft(name), [name]);
  return (
    <div className={styles.group}>
      <button
        type="button"
        className={styles.badge}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className={styles.badgeName}>{name}</span>
        <span className={styles.badgeChevron}>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className={styles.groupDetail}>
          <label className={styles.renameField}>
            <span>Name</span>
            <input
              className={styles.renameInput}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => {
                const v = draft.trim();
                if (v && v !== name) onRename(id, v);
                setDraft(v || name);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              }}
            />
          </label>
          <span className={styles.groupDate}>First boss roll: {when(firstAt)}</span>
        </div>
      )}
    </div>
  );
};

/**
 * The run log: every roll, newest first, grouped by which nuzlocke it belonged
 * to, with whether it was cleared.
 *
 * Entries render from what was stored at the time rather than re-resolving
 * anything against current data — a run that happened is a fact, and a later
 * refresh that retiers an item or renames a fight must not quietly rewrite it.
 *
 * Paged at 5-8 runs per screen; a run can be deleted, with a second click on
 * the trash confirming it so a misclick is never fatal.
 */
export const HistoryPanel = ({
  history,
  nuzlockeNames,
  onMark,
  onDelete,
  onRenameNuzlocke,
  onClose,
}: {
  history: readonly HistoryEntry[];
  nuzlockeNames: Record<string, string>;
  onMark: (id: string, outcome: Outcome) => void;
  onDelete: (id: string) => void;
  onRenameNuzlocke: (id: string, name: string) => void;
  onClose: () => void;
}) => {
  const counts = tally(history);
  const [pageSize, setPageSize] = useState(pageSizeFor);
  const [page, setPage] = useState(0);
  /** The run whose trash is armed; a second click on it deletes. */
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  useEffect(() => {
    const onResize = () => setPageSize(pageSizeFor());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Arming the trash is a momentary state; let it lapse rather than leaving a
  // live grenade on the row.
  useEffect(() => {
    if (!pendingDelete) return;
    const t = window.setTimeout(() => setPendingDelete(null), 2500);
    return () => window.clearTimeout(t);
  }, [pendingDelete]);

  const totalPages = Math.max(1, Math.ceil(history.length / pageSize));
  // A deletion can leave the current page empty; clamp rather than jump back
  // to page 0.
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * pageSize;
  const pageRuns = history.slice(start, start + pageSize);

  /** The nuzlocke a group belongs to, or null for freeplay. */
  const groupOf = (run: HistoryEntry): string | null => run.nuzlockeId;
  const groupName = (id: string | null): string =>
    id == null ? 'Free play' : nuzlockeNames[id] ?? nuzlockeLabel(id);
  const groupFirstAt = (id: string | null): number =>
    Math.min(
      ...history.filter((r) => (r.nuzlockeId ?? null) === id).map((r) => r.at),
    );

  return (
    <div className={styles.backdrop} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <RsPanel title="Run history" className={styles.panel} bodyClassName={styles.panelBody}>
        <div className={styles.summary}>
          <span className={styles.cleared}>{counts.cleared} cleared</span>
          <span className={styles.failed}>{counts.failed} failed</span>
          <span className={styles.unmarked}>{counts.unmarked} unmarked</span>
        </div>

        <div className={styles.body}>
          {history.length === 0 && (
            <span className={styles.empty}>No runs yet. Roll one and it will show up here.</span>
          )}
          {pageRuns.map((run, i) => {
            const prev = pageRuns[i - 1];
            const newGroup = i === 0 || groupOf(run) !== groupOf(prev);
            const gid = groupOf(run);
            return (
              <Fragment key={run.id}>
                {newGroup && (
                  gid == null ? (
                    <span className={styles.freeplay}>Free play</span>
                  ) : (
                    <NuzlockeGroup
                      id={gid}
                      name={groupName(gid)}
                      firstAt={groupFirstAt(gid)}
                      onRename={onRenameNuzlocke}
                    />
                  )
                )}
                <div
                  key={run.id}
                  className={`${styles.run} ${run.outcome ? styles[run.outcome] : ''}`}
                >
                  <img
                    className={styles.bossIcon}
                    src={asset(`img/bosses/${encodeURIComponent(run.bossImage)}`)}
                    alt=""
                    onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
                  />
                  <div className={styles.detail}>
                    <span className={styles.bossName}>
                      {run.boss}
                      {run.hardModeLabel && <span className={styles.hard}>{run.hardModeLabel}</span>}
                    </span>
                    {run.challenge && <span className={styles.challenge}>{run.challenge}</span>}
                    <span className={styles.meta}>
                      <GpValue gp={run.value} />
                      <span className={styles.at}>{when(run.at)}</span>
                    </span>
                    <span className={styles.gear}>
                      {run.gear.map((g, i) => (
                        <img
                          key={`${g.slot}-${i}`}
                          src={asset(`img/items/${g.icon}`)}
                          alt={g.name}
                          title={g.name}
                          onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                      ))}
                    </span>
                  </div>
                  <div className={styles.marks}>
                    <button
                      type="button"
                      className={`${styles.trash} ${pendingDelete === run.id ? styles.trashArmed : ''}`}
                      onClick={() => {
                        if (pendingDelete === run.id) {
                          onDelete(run.id);
                          setPendingDelete(null);
                        } else {
                          setPendingDelete(run.id);
                        }
                      }}
                      aria-label={pendingDelete === run.id ? 'Click again to delete' : 'Delete run'}
                    >
                      <TrashIcon />
                    </button>
                    <button
                      type="button"
                      className={`${styles.mark} ${run.outcome === 'failed' ? styles.markOff : ''}`}
                      onClick={() => onMark(run.id, 'failed')}
                      aria-pressed={run.outcome === 'failed'}
                    >
                      ✗
                    </button>
                    <button
                      type="button"
                      className={`${styles.mark} ${run.outcome === 'cleared' ? styles.markOn : ''}`}
                      onClick={() => onMark(run.id, 'cleared')}
                      aria-pressed={run.outcome === 'cleared'}
                    >
                      ✓
                    </button>
                  </div>
                </div>
              </Fragment>
            );
          })}
        </div>

        {history.length > pageSize && (
          <div className={styles.pager}>
            <button
              type="button"
              className={styles.pagerBtn}
              disabled={safePage === 0}
              onClick={() => setPage(safePage - 1)}
            >
              ‹ Prev
            </button>
            <span className={styles.pagerPage}>
              {safePage + 1} / {totalPages}
            </span>
            <button
              type="button"
              className={styles.pagerBtn}
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage(safePage + 1)}
            >
              Next ›
            </button>
          </div>
        )}

        <RsButton variant="primary" onClick={onClose}>
          Done
        </RsButton>
      </RsPanel>
    </div>
  );
};
