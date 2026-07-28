import type { ButtonHTMLAttributes } from 'react';
import styles from './RsButton.module.css';

/** Themed OSRS button. variant="primary" is the big gold Roll button;
 *  "default" is a stone utility button. */
export const RsButton = ({
  variant = 'default',
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'primary' }) => (
  <button
    className={`${styles.button} ${variant === 'primary' ? styles.primary : ''} ${className ?? ''}`}
    {...rest}
  />
);
