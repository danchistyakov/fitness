import { useEffect, useState, type FormEvent } from 'react';
import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';
import { Plus, ChevronRight } from 'lucide-react';
import {
  sessionsStore, clientsStore, programsStore, trainersStore,
} from '@/stores';
import type { Session, SessionCreate } from '@/types/api';
import { Page } from '@/components/Page';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Input, Textarea, Select } from '@/components/Input';
import { Combobox } from '@/components/Combobox';
import { Modal } from '@/components/Modal';
import { DataTable, type Column } from '@/components/DataTable';
import { Badge } from '@/components/Badge';
import { formatDate } from '@/utils/format';
import s from './Sessions.module.scss';

const Sessions = observer(() => {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

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
      key: 'arrow',
      header: '',
      width: '32px',
      align: 'right',
      cell: () => <ChevronRight size={14} />,
    },
  ];

  return (
    <Page
      title="Тренировки"
      subtitle={`Журнал тренировок • ${sessionsStore.sessions.length}`}
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

export default Sessions;
