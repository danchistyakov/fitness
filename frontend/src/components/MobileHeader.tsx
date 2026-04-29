import { useLocation } from 'react-router-dom';
import { Menu, Activity } from 'lucide-react';
import { ROUTE_TITLES } from '@/utils/roles';
import s from './MobileHeader.module.scss';

interface MobileHeaderProps {
  onMenuClick: () => void;
}

export default function MobileHeader({ onMenuClick }: MobileHeaderProps) {
  const location = useLocation();
  const currentTitle = ROUTE_TITLES.find(([prefix]) =>
    prefix === '/' ? location.pathname === '/' : location.pathname.startsWith(prefix),
  )?.[1] ?? 'FitAnalytics';

  return (
    <header className={s.header}>
      <button className={s.menuBtn} onClick={onMenuClick} aria-label="Меню">
        <Menu size={20} />
      </button>
      <div className={s.title}>
        <span className={s.logoIcon}><Activity size={16} color="var(--bg-0)" /></span>
        <span>{currentTitle}</span>
      </div>
    </header>
  );
}
