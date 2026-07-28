import type { CSSProperties, ReactNode } from 'react';
import styles from './RsPanel.module.css';

/** Themed OSRS panel: dark parchment-brown surface, olive border, optional
 *  title bar with an icon anchor. The stage-2
 *  casino restyle happens here, not in feature components. */
export const RsPanel = ({
  title,
  icon,
  children,
  className,
  style,
}: {
  title?: ReactNode;
  /** Small sprite rendered before the title (e.g. /img/ui/skull.png). */
  icon?: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) => (
  <section className={`${styles.panel} ${className ?? ''}`} style={style}>
    {title !== undefined && (
      <header className={styles.title}>
        <h2>
          {icon && <img src={icon} alt="" onError={(e) => (e.currentTarget.style.display = 'none')} />}
          {title}
        </h2>
      </header>
    )}
    <div className={styles.body}>{children}</div>
  </section>
);
