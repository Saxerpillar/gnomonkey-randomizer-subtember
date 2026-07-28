import type { CSSProperties, ReactNode } from 'react';
import styles from './RsPanel.module.css';

/** Themed OSRS panel: dark parchment-brown surface, olive border, optional
 *  gold serif title bar (the "Tile C3" look). The stage-2 casino restyle
 *  happens here, not in feature components. */
export const RsPanel = ({
  title,
  children,
  className,
  style,
}: {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) => (
  <section className={`${styles.panel} ${className ?? ''}`} style={style}>
    {title !== undefined && (
      <header className={styles.title}>
        <h2>{title}</h2>
      </header>
    )}
    <div className={styles.body}>{children}</div>
  </section>
);
