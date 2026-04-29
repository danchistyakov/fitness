import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import s from './Empty.module.scss';

interface EmptyProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function Empty({ title, description, icon, action }: EmptyProps) {
  return (
    <div className={s.empty}>
      <div className={s.iconWrap}>{icon ?? <Inbox size={28} />}</div>
      <h4 className={s.title}>{title}</h4>
      {description && <p className={s.description}>{description}</p>}
      {action && <div className={s.action}>{action}</div>}
    </div>
  );
}
