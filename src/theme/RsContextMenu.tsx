import { useLayoutEffect, useRef, useState } from 'react';
import styles from './RsContextMenu.module.css';

export interface MenuEntry {
  label: string;
  onSelect: () => void;
}

/**
 * OSRS-style right-click menu: "Choose Option" header, context entries, and
 * Cancel always last. Rendered at the cursor, clamped to the viewport. The
 * host owns open/close state; any selection (including Cancel) closes it.
 */
export const RsContextMenu = ({
  x,
  y,
  entries,
  onClose,
}: {
  x: number;
  y: number;
  entries: MenuEntry[];
  onClose: () => void;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos({
      left: Math.max(0, Math.min(x, window.innerWidth - width - 4)),
      top: Math.max(0, Math.min(y, window.innerHeight - height - 4)),
    });
  }, [x, y]);

  return (
    <div ref={ref} className={styles.menu} style={pos}>
      <div className={styles.header}>Choose Option</div>
      <ul className={styles.list}>
        {entries.map((entry) => (
          <li key={entry.label}>
            <button
              className={styles.option}
              onClick={() => {
                entry.onSelect();
                onClose();
              }}
            >
              {entry.label}
            </button>
          </li>
        ))}
        <li>
          <button className={styles.option} onClick={onClose}>
            Cancel
          </button>
        </li>
      </ul>
    </div>
  );
};
