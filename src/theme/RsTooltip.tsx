import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import styles from './RsTooltip.module.css';

/**
 * Custom OSRS-style hover tooltip (black box, thin border, RS font) — replaces
 * every native `title` attribute. Wraps its children; `content` renders in a
 * bubble above them on hover. Pass `content={null}` to render children with
 * no tooltip at all.
 *
 * The bubble is PORTALED to the document body and pinned to viewport
 * coordinates. That keeps it out of the scrollable panel bodies entirely, so
 * it can neither be clipped by a container edge nor paint a scrollbar into
 * one — and it is clamped to stay within its container's edges, flipping below
 * the target when there is no room above.
 */
export const RsTooltip = ({
  content,
  children,
  className,
  style,
  onClick,
  onContextMenu,
  dataSlot,
  dataSolid,
}: {
  content: ReactNode;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  /** Optional `data-slot` for reveal animations to target this element. */
  dataSlot?: string;
  /** Marks this block as one the emote scatter must not sit on top of. */
  dataSolid?: boolean;
}) => {
  const [show, setShow] = useState(false);
  /** Viewport placement of the bubble, or null before the first measure. */
  const [box, setBox] = useState<{ x: number; y: number; below: boolean } | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    if (!show) return;
    const wrap = wrapRef.current;
    const tip = tipRef.current;
    if (!wrap || !tip) return;
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    // Nearest ancestor that clips (the scrollable panel bodies, or FitScreen's
    // overflow-hidden box) — the bubble is kept within its edges.
    let container: HTMLElement | null = wrap.parentElement;
    while (container && container !== document.body) {
      const oy = getComputedStyle(container).overflowY;
      if (oy === 'auto' || oy === 'scroll' || oy === 'hidden') break;
      container = container.parentElement;
    }
    const wrapRect = wrap.getBoundingClientRect();
    const cRect = (container ?? document.body).getBoundingClientRect();
    // Vertical: above the target, flipping below when there is no room.
    let y = wrapRect.top - h - 7;
    let below = false;
    if (y < cRect.top) {
      y = wrapRect.bottom + 7;
      below = true;
    }
    // Horizontal: centered on the target, clamped inside the container.
    let x = wrapRect.left + wrapRect.width / 2 - w / 2;
    x = Math.max(cRect.left, Math.min(x, cRect.right - w));
    setBox({ x, y, below });
  }, [show]);

  return (
    <>
      <span
        ref={wrapRef}
        className={`${styles.wrap} ${className ?? ''}`}
        style={style}
        data-slot={dataSlot}
        data-solid={dataSolid ? '' : undefined}
        onClick={onClick}
        onContextMenu={onContextMenu}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      >
        {children}
      </span>
      {show &&
        content != null &&
        createPortal(
          <span
            ref={tipRef}
            className={`${styles.tip} ${box?.below ? styles.tipBelow : ''}`}
            role="tooltip"
            style={{ left: box?.x ?? 0, top: box?.y ?? 0 }}
          >
            {content}
          </span>,
          document.body,
        )}
    </>
  );
};
