import type { ReactNode } from 'react';
import s from './Badge.module.scss';

export type BadgeVariant =
  | 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple';

interface BadgeProps {
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  children: ReactNode;
  iconLeft?: ReactNode;
}

export function Badge({
  variant = 'neutral',
  size = 'sm',
  children,
  iconLeft,
}: BadgeProps) {
  const cls = [s.badge, s[`variant-${variant}`], s[`size-${size}`]].join(' ');
  return (
    <span className={cls}>
      {iconLeft && <span className={s.icon}>{iconLeft}</span>}
      {children}
    </span>
  );
}
