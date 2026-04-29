import { useEffect, useState, type FormEvent } from 'react';
import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';
import { Plus, Copy, ChevronRight, Search } from 'lucide-react';
import {
  programsStore, clientsStore, trainersStore, authStore,
} from '@/stores';
import type { ProgramCreate, Program } from '@/types/api';
import { Page } from '@/components/Page';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Input, Textarea, Select } from '@/components/Input';
import { Combobox } from '@/components/Combobox';
import { Modal } from '@/components/Modal';
import { DataTable, type Column } from '@/components/DataTable';
import { Badge } from '@/components/Badge';
import { formatDate, difficultyLabels } from '@/utils/format';
import s from './Programs.module.scss';

const Programs = observer(() => {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [copying, setCopying] = useState<Program | null>(null);
  const isClient = authStore.role === 'client';

  useEffect(() => {
    programsStore.load();
    if (!isClient) {
      clientsStore.load();
      trainersStore.load();
    }
  }, [isClient]);

  const columns: Column<Program>[] = [
    { key: 'name', header: 'Название', cell: p => p.name },
    { key: 'client', header: 'Клиент', cell: p => p.client_name ?? `#${p.client_id}` },
    { key: 'trainer', header: 'Тренер', cell: p => p.trainer_name ?? '—' },
    { key: 'duration', header: 'Длит.', mono: true, cell: p => `${p.duration_weeks} нед.` },
    { key: 'sessions', header: 'Сесс./нед.', mono: true, align: 'right', cell: p => p.sessions_per_week },
    { key: 'level', header: 'Уровень', cell: p => difficultyLabels[p.difficulty_level] ?? p.difficulty_level },
    { key: 'created', header: 'Создана', mono: true, cell: p => formatDate(p.created_at) },
    {
      key: 'status',
      header: 'Статус',
      cell: p => p.is_active
        ? <Badge variant="success">Активна</Badge>
        : <Badge variant="neutral">Завершена</Badge>,
    },
    {
      key: 'actions',
      header: '',
      width: '120px',
      cell: p => isClient ? <ChevronRight size={14} /> : (
        <div className={s.rowActions} onClick={e => e.stopPropagation()}>
          <button
            type="button"
            className={s.iconBtn}
            onClick={() => setCopying(p)}
            title="Копировать программу"
          >
            <Copy size={13} />
          </button>
          <ChevronRight size={14} className={s.arrow} />
        </div>
      ),
    },
  ];

  return (
    <Page
      title="Программы"
      subtitle={isClient ? 'Назначенные вам тренировочные программы' : `Всего: ${programsStore.programs.length}`}
      actions={!isClient && (
        <Button iconLeft={<Plus size={14} />} onClick={() => setCreating(true)}>
          Создать программу
        </Button>
      )}
    >
      {!isClient && (
        <Card padding="compact">
          <div className={s.filters}>
            <div className={s.searchWrap}>
              <Input
                placeholder="Поиск по названию, клиенту или тренеру…"
                iconLeft={<Search size={14} />}
                value={programsStore.search}
                onChange={e => programsStore.setSearch(e.target.value)}
              />
            </div>
          </div>
        </Card>
      )}

      <Card padding="none">
        <DataTable
          columns={columns}
          rows={programsStore.programs}
          rowKey={p => p.id}
          loading={programsStore.isLoading}
          emptyTitle="Программ нет"
          emptyDescription={isClient ? 'Тренер пока не назначил программу' : 'Создайте первую программу'}
          onRowClick={p => navigate(`/programs/${p.id}`)}
        />
      </Card>

      <ProgramCreateModal open={creating} onClose={() => setCreating(false)} />
      <ProgramCopyModal program={copying} onClose={() => setCopying(null)} />
    </Page>
  );
});

interface CreateModalProps { open: boolean; onClose: () => void; }

const ProgramCreateModal = observer(({ open, onClose }: CreateModalProps) => {
  const [form, setForm] = useState<ProgramCreate>({
    client_id: 0,
    trainer_id: null,
    name: '',
    description: '',
    goal: '',
    duration_weeks: 12,
    sessions_per_week: 3,
    difficulty_level: 'medium',
  });
  const [submitting, setSubmitting] = useState(false);

  const clientOptions = clientsStore.clients.map(c => ({ value: c.id, label: c.name, hint: c.email }));
  const trainerOptions = trainersStore.trainers.map(t => ({ value: t.id, label: t.name, hint: t.specialization ?? '' }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.client_id) return;
    setSubmitting(true);
    const id = await programsStore.create({
      ...form,
      description: form.description || null,
      goal: form.goal || null,
    });
    setSubmitting(false);
    if (id !== null) {
      onClose();
      setForm({ client_id: 0, trainer_id: null, name: '', description: '', goal: '', duration_weeks: 12, sessions_per_week: 3, difficulty_level: 'medium' });
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Новая программа"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button form="program-form" type="submit" loading={submitting} disabled={!form.client_id || !form.name}>
            Создать
          </Button>
        </>
      }
    >
      <form id="program-form" onSubmit={onSubmit} className={s.form}>
        <div className={s.formRow}>
          <Field label="Клиент" required>
            <Combobox
              options={clientOptions}
              value={form.client_id || null}
              onChange={v => setForm({ ...form, client_id: typeof v === 'number' ? v : 0 })}
              placeholder="Выберите клиента"
            />
          </Field>
          <Field label="Тренер">
            <Combobox
              options={trainerOptions}
              value={form.trainer_id ?? null}
              onChange={v => setForm({ ...form, trainer_id: typeof v === 'number' ? v : null })}
              placeholder="Без тренера"
            />
          </Field>
        </div>
        <Field label="Название" required>
          <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
        </Field>
        <Field label="Цель">
          <Input value={form.goal ?? ''} onChange={e => setForm({ ...form, goal: e.target.value })} placeholder="Например: набрать мышечную массу" />
        </Field>
        <div className={s.formRow}>
          <Field label="Длительность, недели">
            <Input type="number" min="1" max="52" value={form.duration_weeks} onChange={e => setForm({ ...form, duration_weeks: Number(e.target.value) })} />
          </Field>
          <Field label="Сессий в неделю">
            <Input type="number" min="1" max="14" value={form.sessions_per_week} onChange={e => setForm({ ...form, sessions_per_week: Number(e.target.value) })} />
          </Field>
          <Field label="Уровень">
            <Select value={form.difficulty_level} onChange={e => setForm({ ...form, difficulty_level: e.target.value })}>
              <option value="easy">Лёгкий</option>
              <option value="medium">Средний</option>
              <option value="hard">Высокий</option>
            </Select>
          </Field>
        </div>
        <Field label="Описание">
          <Textarea
            rows={3}
            value={form.description ?? ''}
            onChange={e => setForm({ ...form, description: e.target.value })}
          />
        </Field>
      </form>
    </Modal>
  );
});

interface CopyModalProps { program: Program | null; onClose: () => void; }

const ProgramCopyModal = observer(({ program, onClose }: CopyModalProps) => {
  const [targetClient, setTargetClient] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const clientOptions = clientsStore.clients
    .filter(c => program ? c.id !== program.client_id : true)
    .map(c => ({ value: c.id, label: c.name, hint: c.email }));

  if (!program) return null;

  const onConfirm = async () => {
    if (!targetClient) return;
    setSubmitting(true);
    const id = await programsStore.copy(program.id, targetClient);
    setSubmitting(false);
    if (id !== null) {
      onClose();
      setTargetClient(null);
    }
  };

  return (
    <Modal
      open={!!program}
      onClose={onClose}
      title="Копировать программу"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button onClick={onConfirm} loading={submitting} disabled={!targetClient}>
            Скопировать
          </Button>
        </>
      }
    >
      <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)', fontSize: '0.88rem' }}>
        Копия программы <strong>«{program.name}»</strong> будет назначена выбранному клиенту вместе со всеми упражнениями.
      </p>
      <Field label="Целевой клиент" required>
        <Combobox
          options={clientOptions}
          value={targetClient}
          onChange={v => setTargetClient(typeof v === 'number' ? v : null)}
          placeholder="Выберите клиента"
        />
      </Field>
    </Modal>
  );
});

export default Programs;
