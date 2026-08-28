import type { ButtonHTMLAttributes } from 'react';
import styles from './RsButton.module.css';

type Variant = 'default' | 'primary' | 'success' | 'danger';

const VARIANT_CLASS: Record<Variant, string> = {
  default: '',
  primary: styles.primary,
  success: styles.success,
  danger: styles.danger,
};

interface RsButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

/** Themed OSRS button. "primary" is the big crimson CTA; "success"/"danger"
 *  are the green/red run-outcome buttons; "default" is a stone utility button. */
export const RsButton = ({ variant = 'default', className, ...rest }: RsButtonProps) => (
  <button
    className={`${styles.button} ${VARIANT_CLASS[variant]} ${className ?? ''}`}
    {...rest}
  />
);
