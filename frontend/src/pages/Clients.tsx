import { useEffect, useState, type FormEvent } from 'react';
import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, AlertTriangle, ChevronRight,
} from 'lucide-react';
import { clientsStore } from '@/stores';
import type { Client, ClientCreate } from '@/types/api';
import { Page } from '@/components/Page';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input, Textarea, Select } from '@/components/Input';
import { Field } from '@/components/Field';
import { Modal } from '@/components/Modal';
import { DataTable, type Column } from '@/components/DataTable';
import { Badge } from '@/components/Badge';
import {
  formatDate, subscriptionLabels, goalLabels, levelLabels,
} from '@/utils/format';
import s from './Clients.module.scss';

const Clients = observer(() => {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    clientsStore.load();
  }, []);

  const columns: Column<Client>[] = [
    {
      key: 'name',
      header: 'Имя',
      cell: c => (
        <div className={s.nameCell}>
          <span className={s.nameMain}>{c.name}</span>
          <span className={s.nameSub}>{c.email}</span>
        </div>
      ),
    },
    {
      key: 'sub',
      header: 'Абонемент',
      cell: c => (
        <Badge variant={c.subscription_type === 'vip' ? 'purple' : 'info'}>
          {subscriptionLabels[c.subscription_type] ?? c.subscription_type}
        </Badge>
      ),
    },
    {
      key: 'goal',
      header: 'Цель',
      cell: c => c.fitness_goal ? (goalLabels[c.fitness_goal] ?? c.fitness_goal) : '—',
    },
    {
      key: 'level',
      header: 'Уровень',
      cell: c => c.fitness_level ? (levelLabels[c.fitness_level] ?? c.fitness_level) : '—',
    },
    {
      key: 'sub_start',
      header: 'Начало',
      mono: true,
      cell: c => formatDate(c.subscription_start_date),
    },
    {
      key: 'flags',
      header: '',
      width: '120px',
      cell: c => (
        <div className={s.flags}>
          {c.contraindications && (
            <Badge variant="warning" iconLeft={<AlertTriangle size={10} />}>
              Противопок.
            </Badge>
          )}
          {!c.is_active && (
            <Badge variant="neutral">Деактив.</Badge>
          )}
        </div>
      ),
    },
    {
      key: 'arrow',
      header: '',
      width: '36px',
      align: 'right',
      cell: () => <ChevronRight size={14} className={s.arrow} />,
    },
  ];

  return (
    <Page
      title="Клиенты"
      subtitle={`Всего: ${clientsStore.total}`}
      actions={
        <Button
          iconLeft={<Plus size={14} />}
          onClick={() => setCreating(true)}
        >
          Добавить клиента
        </Button>
      }
    >
      <Card padding="compact">
        <div className={s.filters}>
          <div className={s.searchWrap}>
            <Input
              placeholder="Поиск по имени или email…"
              iconLeft={<Search size={14} />}
              value={clientsStore.search}
              onChange={e => clientsStore.setSearch(e.target.value)}
            />
          </div>
          <div className={s.filterBtns}>
            {(['all', 'active', 'inactive'] as const).map(f => (
              <button
                key={f}
                className={`${s.filterBtn} ${clientsStore.filter === f ? s.filterBtnActive : ''}`}
                onClick={() => clientsStore.setFilter(f)}
              >
                {f === 'all' ? 'Все' : f === 'active' ? 'Активные' : 'Неактивные'}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card padding="none">
        <DataTable
          columns={columns}
          rows={clientsStore.clients}
          rowKey={c => c.id}
          loading={clientsStore.isLoading}
          emptyTitle="Нет клиентов"
          emptyDescription="Добавьте первого клиента, чтобы начать работу"
          onRowClick={c => navigate(`/clients/${c.id}`)}
        />
      </Card>

      <ClientCreateModal
        open={creating}
        onClose={() => setCreating(false)}
      />
    </Page>
  );
});

interface CreateModalProps {
  open: boolean;
  onClose: () => void;
}

function ClientCreateModal({ open, onClose }: CreateModalProps) {
  const [form, setForm] = useState<ClientCreate>({
    name: '',
    email: '',
    phone: '',
    birth_date: '',
    gender: '',
    subscription_type: 'basic',
    subscription_start_date: '',
    fitness_goal: '',
    fitness_level: 'beginner',
    health_notes: '',
    contraindications: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const update = <K extends keyof ClientCreate>(key: K, value: ClientCreate[K]) => {
    setForm(f => ({ ...f, [key]: value }));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const id = await clientsStore.create({
      ...form,
      birth_date: form.birth_date || null,
      subscription_start_date: form.subscription_start_date || null,
      gender: form.gender || null,
      fitness_goal: form.fitness_goal || null,
      health_notes: form.health_notes || null,
      contraindications: form.contraindications || null,
    });
    setSubmitting(false);
    if (id !== null) {
      onClose();
      setForm({
        name: '', email: '', phone: '', birth_date: '', gender: '',
        subscription_type: 'basic', subscription_start_date: '',
        fitness_goal: '', fitness_level: 'beginner',
        health_notes: '', contraindications: '',
      });
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Новый клиент"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button form="client-form" type="submit" loading={submitting}>
            Создать
          </Button>
        </>
      }
    >
      <form id="client-form" className={s.form} onSubmit={onSubmit}>
        <div className={s.formGrid}>
          <Field label="Имя" required>
            <Input value={form.name} onChange={e => update('name', e.target.value)} required />
          </Field>
          <Field label="Email" required>
            <Input type="email" value={form.email} onChange={e => update('email', e.target.value)} required />
          </Field>
          <Field label="Телефон">
            <Input type="tel" value={form.phone ?? ''} onChange={e => update('phone', e.target.value)} />
          </Field>
          <Field label="Дата рождения">
            <Input type="date" value={form.birth_date ?? ''} onChange={e => update('birth_date', e.target.value)} />
          </Field>
          <Field label="Пол">
            <Select value={form.gender ?? ''} onChange={e => update('gender', e.target.value)}>
              <option value="">Не указан</option>
              <option value="male">Мужской</option>
              <option value="female">Женский</option>
            </Select>
          </Field>
          <Field label="Уровень подготовки">
            <Select value={form.fitness_level ?? 'beginner'} onChange={e => update('fitness_level', e.target.value)}>
              <option value="beginner">Новичок</option>
              <option value="intermediate">Средний</option>
              <option value="advanced">Продвинутый</option>
            </Select>
          </Field>
          <Field label="Тип абонемента">
            <Select value={form.subscription_type ?? 'basic'} onChange={e => update('subscription_type', e.target.value)}>
              <option value="basic">Базовый</option>
              <option value="standard">Стандарт</option>
              <option value="premium">Премиум</option>
              <option value="vip">VIP</option>
            </Select>
          </Field>
          <Field label="Начало абонемента">
            <Input type="date" value={form.subscription_start_date ?? ''} onChange={e => update('subscription_start_date', e.target.value)} />
          </Field>
          <Field label="Фитнес-цель">
            <Select value={form.fitness_goal ?? ''} onChange={e => update('fitness_goal', e.target.value)}>
              <option value="">Не указано</option>
              <option value="weight_loss">Похудение</option>
              <option value="muscle_gain">Набор массы</option>
              <option value="endurance">Выносливость</option>
              <option value="flexibility">Гибкость</option>
              <option value="general_fitness">Общая форма</option>
            </Select>
          </Field>
        </div>

        <Field
          label="Заметки по здоровью"
          hint="Перенесённые травмы, хронические заболевания и т.п."
        >
          <Textarea
            rows={3}
            value={form.health_notes ?? ''}
            onChange={e => update('health_notes', e.target.value)}
            placeholder="Например: травма колена 2024, остеохондроз"
          />
        </Field>

        <Field
          label={
            <span className={s.warnLabel}>
              <AlertTriangle size={12} />
              Противопоказания
            </span>
          }
          hint="Что категорически нельзя — отображается тренеру в списке клиентов"
        >
          <Textarea
            rows={2}
            value={form.contraindications ?? ''}
            onChange={e => update('contraindications', e.target.value)}
            placeholder="Например: запрещены становая тяга, прыжковые нагрузки"
          />
        </Field>
      </form>
    </Modal>
  );
}

export default Clients;
