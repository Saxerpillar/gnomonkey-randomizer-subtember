import { useState, type CSSProperties, type ReactNode } from 'react';
import styles from './RsTooltip.module.css';

/**
 * Custom OSRS-style hover tooltip (black box, thin border, RS font) — replaces
 * every native `title` attribute. Wraps its children; `content` renders in a
 * positioned bubble above them on hover. Pass `content={null}` to render
 * children with no tooltip at all.
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
  return (
    <span
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
      {show && content != null && (
        <span className={styles.tip} role="tooltip">
          {content}
        </span>
      )}
    </span>
  );
};
