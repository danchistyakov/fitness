import { useEffect, useState, type FormEvent } from 'react';
import { observer } from 'mobx-react-lite';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Plus, ChevronUp, ChevronDown, FileText,
} from 'lucide-react';
import {
  programsStore, exercisesStore, clientsStore, trainersStore,
} from '@/stores';
import type { ProgramExercise, ProgramExerciseCreate } from '@/types/api';
import { Page } from '@/components/Page';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Input, Textarea, Select } from '@/components/Input';
import { Combobox } from '@/components/Combobox';
import { Modal } from '@/components/Modal';
import { Empty } from '@/components/Empty';
import { Badge } from '@/components/Badge';
import s from './ProgramEditor.module.scss';

const WEEKDAYS = [
  { v: 1, label: 'Пн' }, { v: 2, label: 'Вт' }, { v: 3, label: 'Ср' },
  { v: 4, label: 'Чт' }, { v: 5, label: 'Пт' }, { v: 6, label: 'Сб' },
  { v: 0, label: 'Вс' },
];

const ProgramEditor = observer(() => {
  const { id } = useParams<{ id: string }>();
  const programId = id ? Number(id) : NaN;
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (Number.isNaN(programId)) return;
    programsStore.loadExercises(programId);
    if (programsStore.programs.length === 0) programsStore.load();
    if (clientsStore.clients.length === 0) clientsStore.load();
    if (trainersStore.trainers.length === 0) trainersStore.load();
    if (exercisesStore.exercises.length === 0) exercisesStore.load();
  }, [programId]);

  if (Number.isNaN(programId)) {
    return <Page title="Программа"><Empty title="Некорректный идентификатор" /></Page>;
  }

  const program = programsStore.programs.find(p => p.id === programId);
  const exercisesByDay = groupByDay(programsStore.programExercises);

  return (
    <Page
      title={program?.name ?? 'Программа'}
      subtitle={program ? `Клиент: ${program.client_name} • Тренер: ${program.trainer_name ?? '—'}` : undefined}
      actions={
        <>
          <Button variant="ghost" iconLeft={<ArrowLeft size={14} />} onClick={() => navigate('/programs')}>
            К списку
          </Button>
          <Button iconLeft={<Plus size={14} />} onClick={() => setAdding(true)}>
            Добавить упражнение
          </Button>
        </>
      }
    >
      {programsStore.programExercises.length === 0 && !programsStore.isLoadingExercises ? (
        <Card>
          <Empty
            title="Упражнений ещё нет"
            description="Добавьте упражнения и распределите их по дням недели"
            action={<Button iconLeft={<Plus size={14} />} onClick={() => setAdding(true)}>Добавить</Button>}
          />
        </Card>
      ) : (
        <div className={s.daysGrid}>
          {WEEKDAYS.map(({ v, label }) => {
            const items = exercisesByDay.get(v) ?? [];
            if (items.length === 0) return null;
            return (
              <Card key={v} title={label} subtitle={`${items.length} упражнений`}>
                <ul className={s.exerciseList}>
                  {items.map(pe => (
                    <ExerciseItem key={pe.id} pe={pe} />
                  ))}
                </ul>
              </Card>
            );
          })}
          {exercisesByDay.has(null) && (
            <Card title="Без привязки к дню" subtitle="Распределите по дням недели">
              <ul className={s.exerciseList}>
                {exercisesByDay.get(null)!.map(pe => (
                  <ExerciseItem key={pe.id} pe={pe} />
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      <AddExerciseModal
        open={adding}
        onClose={() => setAdding(false)}
        programId={programId}
      />
    </Page>
  );
});

function groupByDay(items: ProgramExercise[]): Map<number | null, ProgramExercise[]> {
  const map = new Map<number | null, ProgramExercise[]>();
  for (const item of items) {
    const key = item.day_of_week ?? null;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => (a.order_number ?? 0) - (b.order_number ?? 0));
  }
  return map;
}

const ExerciseItem = observer(({ pe }: { pe: ProgramExercise }) => {
  const [showNote, setShowNote] = useState(false);
  return (
    <li className={s.exercise}>
      <div className={s.exerciseHead}>
        <div className={s.exerciseOrder}>{pe.order_number ?? '—'}</div>
        <div className={s.exerciseBody}>
          <div className={s.exerciseName}>{pe.exercise_name}</div>
          <div className={s.exerciseMeta}>
            {pe.muscle_group && <Badge variant="info">{pe.muscle_group}</Badge>}
            <span className={s.exerciseSpec}>
              {pe.sets}×{pe.reps}
              {pe.weight ? ` • ${pe.weight} кг` : ''}
              {' • отдых '}{pe.rest_seconds} с
            </span>
          </div>
        </div>
        {pe.methodical_note && (
          <button
            type="button"
            className={s.noteToggle}
            onClick={() => setShowNote(s_ => !s_)}
            title="Методические указания"
          >
            <FileText size={13} />
            {showNote ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        )}
      </div>
      {showNote && pe.methodical_note && (
        <div className={s.exerciseNote}>{pe.methodical_note}</div>
      )}
    </li>
  );
});

interface AddModalProps {
  open: boolean;
  onClose: () => void;
  programId: number;
}

const AddExerciseModal = observer(({ open, onClose, programId }: AddModalProps) => {
  const [exerciseId, setExerciseId] = useState<number | null>(null);
  const [day, setDay] = useState('1');
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState(12);
  const [weight, setWeight] = useState('');
  const [rest, setRest] = useState(60);
  const [order, setOrder] = useState(1);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const exerciseOptions = exercisesStore.exercises.map(ex => ({
    value: ex.id,
    label: ex.name,
    hint: ex.muscle_group ?? '',
  }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!exerciseId) return;
    setSubmitting(true);
    const payload: ProgramExerciseCreate = {
      program_id: programId,
      exercise_id: exerciseId,
      sets, reps,
      weight: weight ? Number(weight) : null,
      rest_seconds: rest,
      day_of_week: Number(day),
      order_number: order,
      methodical_note: note || null,
    };
    const ok = await programsStore.addExercise(programId, payload);
    setSubmitting(false);
    if (ok) {
      setExerciseId(null);
      setNote('');
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Добавить упражнение в программу"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button form="add-pe" type="submit" loading={submitting} disabled={!exerciseId}>
            Добавить
          </Button>
        </>
      }
    >
      <form id="add-pe" onSubmit={onSubmit} className={s.form}>
        <Field label="Упражнение" required>
          <Combobox
            options={exerciseOptions}
            value={exerciseId}
            onChange={v => setExerciseId(typeof v === 'number' ? v : null)}
            placeholder="Выберите из справочника"
          />
        </Field>
        <div className={s.formGrid}>
          <Field label="День недели">
            <Select value={day} onChange={e => setDay(e.target.value)}>
              {WEEKDAYS.map(d => <option key={d.v} value={d.v}>{d.label}</option>)}
            </Select>
          </Field>
          <Field label="Порядковый номер">
            <Input type="number" min="1" value={order} onChange={e => setOrder(Number(e.target.value))} />
          </Field>
          <Field label="Подходы">
            <Input type="number" min="1" value={sets} onChange={e => setSets(Number(e.target.value))} />
          </Field>
          <Field label="Повторы">
            <Input type="number" min="1" value={reps} onChange={e => setReps(Number(e.target.value))} />
          </Field>
          <Field label="Вес, кг">
            <Input type="number" step="0.5" value={weight} onChange={e => setWeight(e.target.value)} placeholder="—" />
          </Field>
          <Field label="Отдых, сек">
            <Input type="number" min="0" value={rest} onChange={e => setRest(Number(e.target.value))} />
          </Field>
        </div>
        <Field label="Методическое указание" hint="Техника, темп, дыхание, советы">
          <Textarea rows={3} value={note} onChange={e => setNote(e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
});

export default ProgramEditor;
