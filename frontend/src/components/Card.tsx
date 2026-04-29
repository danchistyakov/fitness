import type { HTMLAttributes, ReactNode } from 'react';
import s from './Card.module.scss';

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  variant?: 'data' | 'metric' | 'interactive';
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  padding?: 'none' | 'compact' | 'comfortable';
  children: ReactNode;
}

export function Card({
  variant = 'data',
  title,
  subtitle,
  actions,
  padding = 'comfortable',
  children,
  className = '',
  ...rest
}: CardProps) {
  const cls = [
    s.card,
    s[`variant-${variant}`],
    s[`pad-${padding}`],
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={cls} {...rest}>
      {(title || subtitle || actions) && (
        <header className={s.header}>
          <div className={s.headingText}>
            {title && <h3 className={s.title}>{title}</h3>}
            {subtitle && <p className={s.subtitle}>{subtitle}</p>}
          </div>
          {actions && <div className={s.actions}>{actions}</div>}
        </header>
      )}
      <div className={s.content}>{children}</div>
    </div>
  );
}
