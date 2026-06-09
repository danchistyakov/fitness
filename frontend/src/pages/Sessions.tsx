import { useEffect, useState, type FormEvent } from 'react';
import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import {
  sessionsStore, clientsStore, programsStore, trainersStore,
} from '@/stores';
import type { Session, SessionCreate, SessionUpdate } from '@/types/api';
import { Page } from '@/components/Page';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Input, Textarea, Select } from '@/components/Input';
import { Combobox } from '@/components/Combobox';
import { Modal } from '@/components/Modal';
import { DataTable, type Column } from '@/components/DataTable';
import { Badge } from '@/components/Badge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { formatDate } from '@/utils/format';
import s from './Sessions.module.scss';

const Sessions = observer(() => {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [deletingSession, setDeletingSession] = useState<Session | null>(null);

  useEffect(() => {
    sessionsStore.load();
    clientsStore.load();
    programsStore.load();
    trainersStore.load();
  }, []);

  const columns: Column<Session>[] = [
    { key: 'date', header: 'Дата', mono: true, cell: x => formatDate(x.session_date) },
    { key: 'client', header: 'Клиент', cell: x => x.client_name ?? `#${x.client_id}` },
    { key: 'program', header: 'Программа', cell: x => x.program_name ?? '—' },
    { key: 'trainer', header: 'Тренер', cell: x => x.trainer_name ?? '—' },
    {
      key: 'duration',
      header: 'Длит.',
      mono: true,
      align: 'right',
      cell: x => x.duration_minutes ? `${x.duration_minutes} мин` : '—',
    },
    {
      key: 'sat',
      header: 'Оценка',
      align: 'right',
      cell: x => x.satisfaction_rating ? (
        <Badge variant={x.satisfaction_rating >= 4 ? 'success' : x.satisfaction_rating >= 3 ? 'warning' : 'danger'}>
          {x.satisfaction_rating} / 5
        </Badge>
      ) : '—',
    },
    {
      key: 'actions',
      header: '',
      width: '80px',
      align: 'right',
      cell: x => (
        <div className={s.rowActions} onClick={e => e.stopPropagation()}>
          <button type="button" className={s.iconBtn} onClick={() => setEditingSession(x)} title="Редактировать">
            <Edit2 size={13} />
          </button>
          <button type="button" className={s.iconBtn} onClick={() => setDeletingSession(x)} title="Удалить">
            <Trash2 size={13} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <Page
      title="Тренировки"
      subtitle={`Журнал тренировок – ${sessionsStore.sessions.length} шт.`}
      actions={
        <Button iconLeft={<Plus size={14} />} onClick={() => setCreating(true)}>
          Зафиксировать тренировку
        </Button>
      }
    >
      <Card padding="compact" className={s.filtersCard}>
        <div className={s.filters}>
          <Field label="С">
            <Input
              type="date"
              value={sessionsStore.filters.date_from ?? ''}
              onChange={e => sessionsStore.setFilter('date_from', e.target.value)}
            />
          </Field>
          <Field label="По">
            <Input
              type="date"
              value={sessionsStore.filters.date_to ?? ''}
              onChange={e => sessionsStore.setFilter('date_to', e.target.value)}
            />
          </Field>
          <Field label="Клиент">
            <Combobox
              options={clientsStore.clients.map(c => ({ value: c.id, label: c.name }))}
              value={sessionsStore.filters.client_id ?? null}
              onChange={v => sessionsStore.setFilter('client_id', typeof v === 'number' ? v : undefined)}
              placeholder="Все клиенты"
            />
          </Field>
        </div>
      </Card>

      <Card padding="none">
        <DataTable
          columns={columns}
          rows={sessionsStore.sessions}
          rowKey={x => x.id}
          loading={sessionsStore.isLoading}
          emptyTitle="Тренировок нет"
          onRowClick={x => navigate(`/sessions/${x.id}`)}
        />
      </Card>

      <SessionCreateModal open={creating} onClose={() => setCreating(false)} />
      <SessionEditModal open={!!editingSession} onClose={() => setEditingSession(null)} session={editingSession} />
      <ConfirmDialog
        open={!!deletingSession}
        onCancel={() => setDeletingSession(null)}
        onConfirm={async () => {
          if (deletingSession) {
            await sessionsStore.delete(deletingSession.id);
            setDeletingSession(null);
          }
        }}
        title="Удалить тренировку?"
        message={deletingSession ? `Тренировка от ${formatDate(deletingSession.session_date)} будет удалена.` : ''}
      />
    </Page>
  );
});

interface ModalProps { open: boolean; onClose: () => void; }

const SessionCreateModal = observer(({ open, onClose }: ModalProps) => {
  const [form, setForm] = useState<SessionCreate>({
    client_id: 0,
    program_id: null,
    trainer_id: null,
    session_date: new Date().toISOString().slice(0, 10),
    start_time: '',
    duration_minutes: 60,
    calories_burned: null,
    fatigue_level: 5,
    satisfaction_rating: 4,
    comment: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const clientOptions = clientsStore.clients.map(c => ({ value: c.id, label: c.name }));
  const programOptions = programsStore.programs
    .filter(p => !form.client_id || p.client_id === form.client_id)
    .map(p => ({ value: p.id, label: p.name }));
  const trainerOptions = trainersStore.trainers.map(t => ({ value: t.id, label: t.name }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.client_id) return;
    setSubmitting(true);
    const id = await sessionsStore.create({
      ...form,
      start_time: form.start_time || null,
      comment: form.comment || null,
    });
    setSubmitting(false);
    if (id !== null) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Новая тренировка"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button form="ses-form" type="submit" loading={submitting} disabled={!form.client_id}>
            Сохранить
          </Button>
        </>
      }
    >
      <form id="ses-form" onSubmit={onSubmit} className={s.form}>
        <div className={s.formRow}>
          <Field label="Клиент" required>
            <Combobox
              options={clientOptions}
              value={form.client_id || null}
              onChange={v => {
                const clientId = typeof v === 'number' ? v : 0;
                const client = clientsStore.clients.find(c => c.id === clientId);
                setForm({
                  ...form,
                  client_id: clientId,
                  program_id: null,
                  trainer_id: client?.trainer_id ?? null,
                });
              }}
              placeholder="Выберите клиента"
            />
          </Field>
          <Field label="Программа">
            <Combobox
              options={programOptions}
              value={form.program_id ?? null}
              onChange={v => setForm({ ...form, program_id: typeof v === 'number' ? v : null })}
              placeholder="Без привязки"
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
        <div className={s.formRow}>
          <Field label="Дата" required>
            <Input type="date" value={form.session_date} onChange={e => setForm({ ...form, session_date: e.target.value })} required />
          </Field>
          <Field label="Время старта">
            <Input type="time" value={form.start_time ?? ''} onChange={e => setForm({ ...form, start_time: e.target.value })} />
          </Field>
          <Field label="Длительность, мин">
            <Input type="number" min="0" value={form.duration_minutes ?? ''} onChange={e => setForm({ ...form, duration_minutes: e.target.value ? Number(e.target.value) : null })} />
          </Field>
        </div>
        <div className={s.formRow}>
          <Field label="Сожжено ккал">
            <Input type="number" min="0" value={form.calories_burned ?? ''} onChange={e => setForm({ ...form, calories_burned: e.target.value ? Number(e.target.value) : null })} />
          </Field>
          <Field label="Усталость 1–10">
            <Input type="number" min="1" max="10" value={form.fatigue_level ?? ''} onChange={e => setForm({ ...form, fatigue_level: e.target.value ? Number(e.target.value) : null })} />
          </Field>
          <Field label="Удовлетворённость">
            <Select value={form.satisfaction_rating ?? 4} onChange={e => setForm({ ...form, satisfaction_rating: Number(e.target.value) })}>
              <option value="5">5 — отлично</option>
              <option value="4">4 — хорошо</option>
              <option value="3">3 — нормально</option>
              <option value="2">2 — плохо</option>
              <option value="1">1 — ужасно</option>
            </Select>
          </Field>
        </div>
        <Field label="Комментарий">
          <Textarea
            rows={2}
            value={form.comment ?? ''}
            onChange={e => setForm({ ...form, comment: e.target.value })}
          />
        </Field>
      </form>
    </Modal>
  );
});

interface EditModalProps { open: boolean; onClose: () => void; session: Session | null; }

const SessionEditModal = observer(({ open, onClose, session }: EditModalProps) => {
  const [form, setForm] = useState<SessionUpdate>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (session) {
      setForm({
        session_date: session.session_date,
        start_time: session.start_time,
        duration_minutes: session.duration_minutes,
        calories_burned: session.calories_burned,
        fatigue_level: session.fatigue_level,
        satisfaction_rating: session.satisfaction_rating,
        comment: session.comment,
      });
    }
  }, [session]);

  if (!session) return null;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const ok = await sessionsStore.update(session.id, form);
    setSubmitting(false);
    if (ok) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Редактировать тренировку"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button form="ses-edit-form" type="submit" loading={submitting}>
            Сохранить
          </Button>
        </>
      }
    >
      <form id="ses-edit-form" onSubmit={onSubmit} className={s.form}>
        <div className={s.formRow}>
          <Field label="Дата" required>
            <Input type="date" value={form.session_date ?? ''} onChange={e => setForm({ ...form, session_date: e.target.value })} required />
          </Field>
          <Field label="Время старта">
            <Input type="time" value={form.start_time ?? ''} onChange={e => setForm({ ...form, start_time: e.target.value })} />
          </Field>
          <Field label="Длительность, мин">
            <Input type="number" min="0" value={form.duration_minutes ?? ''} onChange={e => setForm({ ...form, duration_minutes: e.target.value ? Number(e.target.value) : null })} />
          </Field>
        </div>
        <div className={s.formRow}>
          <Field label="Сожжено ккал">
            <Input type="number" min="0" value={form.calories_burned ?? ''} onChange={e => setForm({ ...form, calories_burned: e.target.value ? Number(e.target.value) : null })} />
          </Field>
          <Field label="Усталость 1–10">
            <Input type="number" min="1" max="10" value={form.fatigue_level ?? ''} onChange={e => setForm({ ...form, fatigue_level: e.target.value ? Number(e.target.value) : null })} />
          </Field>
          <Field label="Удовлетворённость">
            <Select value={form.satisfaction_rating ?? 4} onChange={e => setForm({ ...form, satisfaction_rating: Number(e.target.value) })}>
              <option value="5">5 — отлично</option>
              <option value="4">4 — хорошо</option>
              <option value="3">3 — нормально</option>
              <option value="2">2 — плохо</option>
              <option value="1">1 — ужасно</option>
            </Select>
          </Field>
        </div>
        <Field label="Комментарий">
          <Textarea
            rows={2}
            value={form.comment ?? ''}
            onChange={e => setForm({ ...form, comment: e.target.value })}
          />
        </Field>
      </form>
    </Modal>
  );
});

export default Sessions;
