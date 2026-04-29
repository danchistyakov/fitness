import type { ReactNode } from 'react';
import s from './Page.module.scss';

interface PageProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function Page({ title, subtitle, actions, children }: PageProps) {
  return (
    <div className={s.page}>
      <header className={s.header}>
        <div className={s.heading}>
          <h1 className={s.title}>{title}</h1>
          {subtitle && <p className={s.subtitle}>{subtitle}</p>}
        </div>
        {actions && <div className={s.actions}>{actions}</div>}
      </header>
      <div className={s.body}>{children}</div>
    </div>
  );
}
