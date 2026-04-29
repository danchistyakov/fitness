import { useEffect, useState, type FormEvent } from 'react';
import { observer } from 'mobx-react-lite';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Activity } from 'lucide-react';
import {
  sessionsStore, exercisesStore,
} from '@/stores';
import type { Session, SessionExerciseCreate } from '@/types/api';
import { Page } from '@/components/Page';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Stat } from '@/components/Stat';
import { Field } from '@/components/Field';
import { Input } from '@/components/Input';
import { Combobox } from '@/components/Combobox';
import { Modal } from '@/components/Modal';
import { Empty } from '@/components/Empty';
import { Badge } from '@/components/Badge';
import { formatDate } from '@/utils/format';
import s from './SessionDetail.module.scss';

const SessionDetail = observer(() => {
  const { id } = useParams<{ id: string }>();
  const sessionId = id ? Number(id) : NaN;
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (Number.isNaN(sessionId)) return;
    sessionsStore.loadExercises(sessionId);
    if (exercisesStore.exercises.length === 0) exercisesStore.load();
    if (sessionsStore.sessions.length === 0) sessionsStore.load();
  }, [sessionId]);

  if (Number.isNaN(sessionId)) {
    return <Page title="Тренировка"><Empty title="Некорректный идентификатор" /></Page>;
  }

  const session: Session | undefined = sessionsStore.sessions.find(s_ => s_.id === sessionId);

  return (
    <Page
      title={session ? `Тренировка ${formatDate(session.session_date)}` : 'Тренировка'}
      subtitle={session ? `${session.client_name ?? `#${session.client_id}`}${session.trainer_name ? ` • ${session.trainer_name}` : ''}` : undefined}
      actions={
        <>
          <Button variant="ghost" iconLeft={<ArrowLeft size={14} />} onClick={() => navigate('/sessions')}>
            К списку
          </Button>
          <Button iconLeft={<Plus size={14} />} onClick={() => setAdding(true)}>
            Добавить упражнение
          </Button>
        </>
      }
    >
      {session && (
        <div className={s.statsGrid}>
          <Stat label="Длительность" value={session.duration_minutes ?? '—'} unit="мин" />
          <Stat label="Калории" value={session.calories_burned ?? '—'} unit="ккал" />
          <Stat
            label="Удовлетворённость"
            value={session.satisfaction_rating ? `${session.satisfaction_rating} / 5` : '—'}
            tone={session.satisfaction_rating && session.satisfaction_rating >= 4 ? 'success' : 'warning'}
          />
        </div>
      )}

      {session?.comment && (
        <Card title="Комментарий">
          <p style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
            {session.comment}
          </p>
        </Card>
      )}

      <Card title="Выполненные упражнения" subtitle={`${sessionsStore.sessionExercises.length} записей`}>
        {sessionsStore.sessionExercises.length === 0 ? (
          <Empty
            title="Упражнения не зафиксированы"
            description="Добавьте упражнения, выполненные в ходе тренировки"
            action={<Button iconLeft={<Plus size={14} />} onClick={() => setAdding(true)}>Добавить</Button>}
          />
        ) : (
          <ul className={s.list}>
            {sessionsStore.sessionExercises.map(se => (
              <li key={se.id} className={s.item}>
                <div className={s.itemIcon}><Activity size={14} /></div>
                <div className={s.itemMain}>
                  <div className={s.itemName}>{se.exercise_name}</div>
                  <div className={s.itemSpecs}>
                    {se.actual_sets !== null && (
                      <span>{se.actual_sets}×{se.actual_reps ?? '—'}</span>
                    )}
                    {se.actual_weight !== null && <span>{se.actual_weight} кг</span>}
                    {se.actual_duration_seconds !== null && (
                      <span>{Math.round(se.actual_duration_seconds / 60)} мин</span>
                    )}
                    {se.calories_burned !== null && <span>{se.calories_burned} ккал</span>}
                  </div>
                </div>
                {se.rpe && (
                  <Badge variant={se.rpe >= 8 ? 'danger' : se.rpe >= 6 ? 'warning' : 'info'}>
                    RPE {se.rpe}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <AddSessionExerciseModal
        open={adding}
        onClose={() => setAdding(false)}
        sessionId={sessionId}
      />
    </Page>
  );
});

interface AddModalProps {
  open: boolean;
  onClose: () => void;
  sessionId: number;
}

const AddSessionExerciseModal = observer(({ open, onClose, sessionId }: AddModalProps) => {
  const [exerciseId, setExerciseId] = useState<number | null>(null);
  const [sets, setSets] = useState('');
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [duration, setDuration] = useState('');
  const [rpe, setRpe] = useState('');
  const [calories, setCalories] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const options = exercisesStore.exercises.map(ex => ({
    value: ex.id,
    label: ex.name,
    hint: ex.muscle_group ?? '',
  }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!exerciseId) return;
    setSubmitting(true);
    const payload: SessionExerciseCreate = {
      session_id: sessionId,
      exercise_id: exerciseId,
      actual_sets: sets ? Number(sets) : null,
      actual_reps: reps ? Number(reps) : null,
      actual_weight: weight ? Number(weight) : null,
      actual_duration_seconds: duration ? Number(duration) * 60 : null,
      rpe: rpe ? Number(rpe) : null,
      calories_burned: calories ? Number(calories) : null,
    };
    const ok = await sessionsStore.addExercise(sessionId, payload);
    setSubmitting(false);
    if (ok) {
      onClose();
      setExerciseId(null);
      setSets(''); setReps(''); setWeight(''); setDuration(''); setRpe(''); setCalories('');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Добавить упражнение"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button form="add-se" type="submit" loading={submitting} disabled={!exerciseId}>
            Добавить
          </Button>
        </>
      }
    >
      <form id="add-se" onSubmit={onSubmit} className={s.form}>
        <Field label="Упражнение" required>
          <Combobox
            options={options}
            value={exerciseId}
            onChange={v => setExerciseId(typeof v === 'number' ? v : null)}
            placeholder="Выберите из справочника"
          />
        </Field>
        <div className={s.formGrid}>
          <Field label="Подходы">
            <Input type="number" min="0" value={sets} onChange={e => setSets(e.target.value)} />
          </Field>
          <Field label="Повторы">
            <Input type="number" min="0" value={reps} onChange={e => setReps(e.target.value)} />
          </Field>
          <Field label="Вес, кг">
            <Input type="number" step="0.5" value={weight} onChange={e => setWeight(e.target.value)} />
          </Field>
          <Field label="Длит., мин">
            <Input type="number" min="0" value={duration} onChange={e => setDuration(e.target.value)} />
          </Field>
          <Field label="RPE 1–10" hint="Subjective Effort">
            <Input type="number" min="1" max="10" value={rpe} onChange={e => setRpe(e.target.value)} />
          </Field>
          <Field label="Ккал">
            <Input type="number" min="0" value={calories} onChange={e => setCalories(e.target.value)} />
          </Field>
        </div>
      </form>
    </Modal>
  );
});

export default SessionDetail;
