import type { ButtonHTMLAttributes, ReactNode } from 'react';
import s from './Button.module.scss';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  iconLeft,
  iconRight,
  loading = false,
  disabled,
  children,
  className = '',
  ...rest
}: ButtonProps) {
  const cls = [
    s.btn,
    s[`variant-${variant}`],
    s[`size-${size}`],
    fullWidth && s.fullWidth,
    loading && s.loading,
    className,
  ].filter(Boolean).join(' ');

  return (
    <button className={cls} disabled={disabled || loading} {...rest}>
      {iconLeft && <span className={s.icon}>{iconLeft}</span>}
      <span className={s.label}>{children}</span>
      {iconRight && <span className={s.icon}>{iconRight}</span>}
    </button>
  );
}
