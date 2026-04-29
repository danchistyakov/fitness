import type { ReactNode } from 'react';
import s from './Tabs.module.scss';

export interface TabItem {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
}

interface TabsProps {
  items: TabItem[];
  active: string;
  onChange: (id: string) => void;
}

export function Tabs({ items, active, onChange }: TabsProps) {
  return (
    <div className={s.tabs} role="tablist">
      {items.map(item => (
        <button
          key={item.id}
          role="tab"
          aria-selected={active === item.id}
          className={`${s.tab} ${active === item.id ? s.tabActive : ''}`}
          onClick={() => onChange(item.id)}
        >
          {item.icon && <span className={s.tabIcon}>{item.icon}</span>}
          {item.label}
        </button>
      ))}
    </div>
  );
}
