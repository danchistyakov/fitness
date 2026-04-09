import React, { useState } from 'react';
import { Shield, UserCheck, User, Check, Minus, ChevronDown, ChevronRight, Lock, Eye, Edit3, Trash2 } from 'lucide-react';

// ─── Data ──────────────────────────────────────────────────────────────────────

const ROLES = [
  {
    id: 'admin',
    label: 'Администратор',
    icon: Shield,
    color: '#00d4aa',
    bg: 'var(--success-soft)',
    borderColor: '#00d4aa',
    description: 'Привилегированный пользователь, отвечающий за настройку системы, управление учётными записями и контроль деятельности фитнес-центра.',
    capabilities: [
      'Регистрация и управление всеми пользователями',
      'Полный доступ ко всем аналитическим отчётам',
      'Управление каталогом упражнений',
      'Назначение клиентов тренерам',
      'Сводная финансовая отчётность',
      'Просмотр журнала действий пользователей',
    ],
  },
  {
    id: 'trainer',
    label: 'Тренер',
    icon: UserCheck,
    color: '#5c7cfa',
    bg: 'var(--info-soft)',
    borderColor: '#5c7cfa',
    description: 'Ключевой пользователь тренировочного процесса. Управляет программами и профилями закреплённых клиентов.',
    capabilities: [
      'Просмотр и редактирование профилей своих клиентов',
      'Создание и корректировка тренировочных программ',
      'Фиксация результатов тренировок',
      'Аналитика прогресса клиентов',
      'Сравнительный анализ программ',
    ],
  },
  {
    id: 'client',
    label: 'Клиент',
    icon: User,
    color: '#a855f7',
    bg: 'var(--purple-soft)',
    borderColor: '#a855f7',
    description: 'Конечный потребитель услуг. Взаимодействует с системой для просмотра программ, внесения данных и отслеживания своего прогресса.',
    capabilities: [
      'Просмотр своей тренировочной программы',
      'Отметка выполненных тренировок',
      'Оценка самочувствия и внесение результатов',
      'Просмотр динамики антропометрических показателей',
      'Управление личными целями',
    ],
  },
];

const PERMISSION_MATRIX = [
  {
    block: 'Управление пользователями',
    color: '#00d4aa',
    items: [
      { label: 'Регистрация пользователя',      admin: true,  trainer: false, client: false },
      { label: 'Ведение профиля клиента',        admin: true,  trainer: true,  client: false },
      { label: 'Фиксация результатов тестирования', admin: true, trainer: true, client: false },
      { label: 'Управление целями клиента',      admin: true,  trainer: true,  client: true  },
      { label: 'Назначение клиента тренеру',     admin: true,  trainer: false, client: false },
    ],
  },
  {
    block: 'Каталог упражнений',
    color: '#5c7cfa',
    items: [
      { label: 'Добавление упражнения',         admin: true,  trainer: true,  client: false },
      { label: 'Поиск и фильтрация упражнений', admin: true,  trainer: true,  client: true  },
    ],
  },
  {
    block: 'Тренировочные программы',
    color: '#a855f7',
    items: [
      { label: 'Создание программы',             admin: true,  trainer: true,  client: false },
      { label: 'Назначение программы клиенту',   admin: true,  trainer: true,  client: false },
      { label: 'Корректировка программы',        admin: true,  trainer: true,  client: false },
      { label: 'Просмотр программы',             admin: true,  trainer: true,  client: true  },
    ],
  },
  {
    block: 'Учёт тренировочного процесса',
    color: '#ffc107',
    items: [
      { label: 'Отметка выполненной тренировки',  admin: true,  trainer: true,  client: true  },
      { label: 'Внесение фактических результатов', admin: true, trainer: true,  client: true  },
      { label: 'Оценка самочувствия (RPE)',        admin: false, trainer: false, client: true  },
      { label: 'Добавление комментариев',          admin: true,  trainer: true,  client: true  },
    ],
  },
  {
    block: 'Аналитика и отчётность',
    color: '#ff4757',
    items: [
      { label: 'Анализ динамики показателей клиента', admin: true, trainer: true, client: true  },
      { label: 'Отчёт по клиенту',                   admin: true, trainer: true, client: true  },
      { label: 'Сравнительный анализ программ',       admin: true, trainer: true, client: false },
      { label: 'Сводная отчётность для руководства',  admin: true, trainer: false, client: false },
    ],
  },
];

// ─── Role card ─────────────────────────────────────────────────────────────────

const RoleCard = ({ role, isSelected, onSelect }) => {
  const Icon = role.icon;

  return (
    <div
      className="card"
      onClick={onSelect}
      style={{
        cursor: 'pointer',
        borderColor: isSelected ? role.borderColor : 'var(--border-color)',
        boxShadow: isSelected ? `0 0 0 1px ${role.borderColor}, 0 4px 20px rgba(0,0,0,0.4)` : undefined,
        transition: 'all 200ms ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '16px' }}>
        <div style={{
          width: '48px', height: '48px', borderRadius: '12px',
          background: role.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon size={24} color={role.color} />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '4px' }}>{role.label}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {PERMISSION_MATRIX.reduce((sum, b) => sum + b.items.filter(i => i[role.id]).length, 0)} разрешений из {PERMISSION_MATRIX.reduce((sum, b) => sum + b.items.length, 0)}
          </div>
        </div>
      </div>

      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '16px' }}>
        {role.description}
      </p>

      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
          Ключевые возможности
        </div>
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {role.capabilities.map((cap, i) => (
            <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <Check size={14} color={role.color} style={{ marginTop: '2px', flexShrink: 0 }} />
              {cap}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

// ─── Permission cell ───────────────────────────────────────────────────────────

const PermCell = ({ allowed, roleId }) => {
  const role = ROLES.find(r => r.id === roleId);
  if (allowed) {
    return (
      <td style={{ padding: '12px 16px', textAlign: 'center', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: '28px', height: '28px', borderRadius: '50%', background: role.bg }}>
          <Check size={14} color={role.color} strokeWidth={2.5} />
        </div>
      </td>
    );
  }
  return (
    <td style={{ padding: '12px 16px', textAlign: 'center', borderBottom: '1px solid var(--border-color)' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: '28px', height: '28px', borderRadius: '50%', background: 'var(--bg-elevated)' }}>
        <Minus size={12} color="var(--text-muted)" />
      </div>
    </td>
  );
};

// ─── Main page ─────────────────────────────────────────────────────────────────

const AccessControl = () => {
  const [selectedRole, setSelectedRole] = useState(null);
  const [expandedBlocks, setExpandedBlocks] = useState(
    Object.fromEntries(PERMISSION_MATRIX.map(b => [b.block, true]))
  );

  const toggleBlock = (block) => {
    setExpandedBlocks(prev => ({ ...prev, [block]: !prev[block] }));
  };

  const filteredMatrix = PERMISSION_MATRIX.map(block => ({
    ...block,
    items: selectedRole
      ? block.items.filter(item => item[selectedRole])
      : block.items,
  })).filter(block => block.items.length > 0);

  const totalAllowed = selectedRole
    ? PERMISSION_MATRIX.reduce((sum, b) => sum + b.items.filter(i => i[selectedRole]).length, 0)
    : PERMISSION_MATRIX.reduce((sum, b) => sum + b.items.length, 0);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Права доступа и роли</h1>
        <p className="page-subtitle">
          Ролевая модель системы — три категории пользователей с разграниченным доступом к функциям
        </p>
      </div>

      {/* Role cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '32px' }}>
        {ROLES.map(role => (
          <RoleCard
            key={role.id}
            role={role}
            isSelected={selectedRole === role.id}
            onSelect={() => setSelectedRole(selectedRole === role.id ? null : role.id)}
          />
        ))}
      </div>

      {/* Filter indicator */}
      {selectedRole && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px', borderRadius: '12px', marginBottom: '20px',
          background: (() => { const r = ROLES.find(r => r.id === selectedRole); return r.bg; })(),
          border: `1px solid ${ROLES.find(r => r.id === selectedRole).borderColor}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Lock size={16} color={ROLES.find(r => r.id === selectedRole).color} />
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
              Показаны только разрешения для роли «{ROLES.find(r => r.id === selectedRole).label}» — {totalAllowed} из {PERMISSION_MATRIX.reduce((s, b) => s + b.items.length, 0)}
            </span>
          </div>
          <button
            className="btn btn-ghost"
            style={{ padding: '4px 12px', fontSize: '0.8rem' }}
            onClick={() => setSelectedRole(null)}
          >
            Сбросить
          </button>
        </div>
      )}

      {/* Permission matrix */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Lock size={20} color="var(--text-muted)" />
          <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>Матрица разграничения доступа</h3>
          <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Таблица 2 — Функциональные блоки и ролевой доступ
          </span>
        </div>

        <div className="table-container">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', width: '220px', borderBottom: '1px solid var(--border-color)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                  Функциональный блок
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid var(--border-color)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                  Вариант использования
                </th>
                {ROLES.map(role => {
                  const Icon = role.icon;
                  return (
                    <th
                      key={role.id}
                      style={{
                        padding: '12px 16px', textAlign: 'center', width: '130px',
                        borderBottom: '1px solid var(--border-color)',
                        borderLeft: '1px solid var(--border-color)',
                        background: selectedRole === role.id ? role.bg : undefined,
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '8px', background: role.bg,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Icon size={16} color={role.color} />
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: selectedRole === role.id ? role.color : 'var(--text-secondary)', letterSpacing: '0', textTransform: 'none' }}>
                          {role.label}
                        </span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filteredMatrix.map((block) => (
                <React.Fragment key={block.block}>
                  {/* Block header row */}
                  <tr
                    onClick={() => toggleBlock(block.block)}
                    style={{ cursor: 'pointer', background: 'var(--bg-secondary)', userSelect: 'none' }}
                  >
                    <td
                      colSpan={5}
                      style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-color)', borderTop: '1px solid var(--border-color)' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: block.color, flexShrink: 0 }} />
                        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{block.block}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                          {block.items.length} {block.items.length === 1 ? 'действие' : block.items.length < 5 ? 'действия' : 'действий'}
                        </span>
                        {expandedBlocks[block.block]
                          ? <ChevronDown size={14} color="var(--text-muted)" />
                          : <ChevronRight size={14} color="var(--text-muted)" />
                        }
                      </div>
                    </td>
                  </tr>

                  {/* Permission rows */}
                  {expandedBlocks[block.block] && block.items.map((item, idx) => (
                    <tr key={idx} style={{ transition: 'background 150ms ease' }}>
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.8rem' }} />
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        {item.label}
                      </td>
                      {ROLES.map(role => (
                        <td key={role.id} style={{
                          padding: '12px 16px', textAlign: 'center',
                          borderBottom: '1px solid var(--border-color)',
                          borderLeft: '1px solid var(--border-color)',
                          background: selectedRole === role.id ? `${role.bg}33` : undefined,
                        }}>
                          {item[role.id] ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              width: '28px', height: '28px', borderRadius: '50%', background: role.bg }}>
                              <Check size={14} color={role.color} strokeWidth={2.5} />
                            </div>
                          ) : (
                            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              width: '28px', height: '28px', borderRadius: '50%', background: 'var(--bg-elevated)' }}>
                              <Minus size={12} color="var(--text-muted)" />
                            </div>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div style={{
          padding: '16px 24px', background: 'var(--bg-secondary)',
          borderTop: '1px solid var(--border-color)',
          display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Условные обозначения:
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--success-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Check size={12} color="var(--success)" strokeWidth={2.5} />
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Доступ разрешён</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Minus size={11} color="var(--text-muted)" />
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Доступ запрещён</span>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Всего действий: {PERMISSION_MATRIX.reduce((s, b) => s + b.items.length, 0)} •
            Кликните по роли для фильтрации
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccessControl;
