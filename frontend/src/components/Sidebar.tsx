import { observer } from 'mobx-react-lite';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Dumbbell, Target, ClipboardList,
  TrendingDown, Component as Cluster, BarChart3, Lightbulb,
  ShieldCheck, LogOut, Activity, Shield, UserCheck, User, UsersRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { authStore } from '@/stores';
import { ROLE_PAGES } from '@/utils/roles';
import s from './Sidebar.module.scss';

interface NavItem {
  id: string;
  path: string;
  label: string;
  icon: LucideIcon;
  section: 'main' | 'analytics' | 'system';
}

const ALL_NAV: NavItem[] = [
  { id: 'dashboard',          path: '/',                   label: 'Дашборд',           icon: LayoutDashboard, section: 'main' },
  { id: 'clients',            path: '/clients',            label: 'Клиенты',           icon: Users,           section: 'main' },
  { id: 'exercises',          path: '/exercises',          label: 'Упражнения',        icon: Dumbbell,        section: 'main' },
  { id: 'programs',           path: '/programs',           label: 'Программы',         icon: Target,          section: 'main' },
  { id: 'sessions',           path: '/sessions',           label: 'Тренировки',        icon: ClipboardList,   section: 'main' },
  { id: 'churn',              path: '/churn',              label: 'Анализ оттока',     icon: TrendingDown,    section: 'analytics' },
  { id: 'segments',           path: '/segments',           label: 'Сегменты',          icon: Cluster,         section: 'analytics' },
  { id: 'programs-analytics', path: '/programs-analytics', label: 'Сравнение программ', icon: BarChart3,      section: 'analytics' },
  { id: 'recommendations',    path: '/recommendations',    label: 'Рекомендации',      icon: Lightbulb,       section: 'analytics' },
  { id: 'access',             path: '/access',             label: 'Права доступа',     icon: ShieldCheck,     section: 'system' },
  { id: 'trainers-accounts',  path: '/trainers-accounts',  label: 'Аккаунты тренеров', icon: UsersRound,      section: 'system' },
];

const ROLE_META = {
  admin:   { label: 'Администратор', icon: Shield,    color: 'var(--success)' },
  trainer: { label: 'Тренер',        icon: UserCheck, color: 'var(--info)' },
  client:  { label: 'Клиент',        icon: User,      color: 'var(--purple)' },
} as const;

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar = observer(({ isOpen, onClose }: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const role = authStore.role;
  const allowed = role ? ROLE_PAGES[role] : [];
  const visible = ALL_NAV.filter(item => allowed.includes(item.id));

  const main      = visible.filter(i => i.section === 'main');
  const analytics = visible.filter(i => i.section === 'analytics');
  const system    = visible.filter(i => i.section === 'system');

  const meta = role ? ROLE_META[role] : null;
  const RoleIcon = meta?.icon;

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const go = (path: string) => { navigate(path); onClose(); };

  return (
    <>
      {isOpen && <div className={s.overlay} onClick={onClose} />}
      <aside className={`${s.sidebar} ${isOpen ? s.open : ''}`}>
        <div className={s.logo}>
          <div className={s.logoIcon}><Activity size={18} color="var(--bg-0)" /></div>
          <span className={s.logoText}>
            Fit<span className={s.logoTextAccent}>Analytics</span>
          </span>
        </div>

        {authStore.user && meta && RoleIcon && (
          <div className={s.userCard} style={{ borderColor: `color-mix(in srgb, ${meta.color} 30%, transparent)` }}>
            <div className={s.userIcon} style={{ background: `color-mix(in srgb, ${meta.color} 15%, transparent)`, color: meta.color }}>
              <RoleIcon size={14} />
            </div>
            <div className={s.userInfo}>
              <div className={s.userName}>{authStore.user.full_name}</div>
              <div className={s.userRole} style={{ color: meta.color }}>{meta.label}</div>
            </div>
          </div>
        )}

        <nav className={s.nav}>
          {main.length > 0 && (
            <NavGroup title="Основное" items={main} isActive={isActive} go={go} />
          )}
          {analytics.length > 0 && (
            <NavGroup title="Аналитика" items={analytics} isActive={isActive} go={go} />
          )}
          {system.length > 0 && (
            <NavGroup title="Система" items={system} isActive={isActive} go={go} />
          )}

          <div className={`${s.group} ${s.groupBottom}`}>
            <div className={s.groupTitle}>Аккаунт</div>

            <button
              className={`${s.navItem} ${s.navItemDanger}`}
              onClick={() => authStore.logout()}
            >
              <LogOut size={16} /><span>Выйти</span>
            </button>
          </div>
        </nav>

        <div className={s.footer}>
          <div className={s.footerLabel}>ВКР • Бакалавриат</div>
          <div className={s.footerVersion}>v2.0.0</div>
        </div>
      </aside>
    </>
  );
});

interface NavGroupProps {
  title: string;
  items: NavItem[];
  isActive: (path: string) => boolean;
  go: (path: string) => void;
}

function NavGroup({ title, items, isActive, go }: NavGroupProps) {
  return (
    <div className={s.group}>
      <div className={s.groupTitle}>{title}</div>
      {items.map(item => (
        <button
          key={item.id}
          className={`${s.navItem} ${isActive(item.path) ? s.navItemActive : ''}`}
          onClick={() => go(item.path)}
        >
          <item.icon size={16} /><span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

export default Sidebar;
