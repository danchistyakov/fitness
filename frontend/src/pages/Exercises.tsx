import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { observer } from 'mobx-react-lite';
import { Plus, Search, Dumbbell } from 'lucide-react';
import { exercisesStore } from '@/stores';
import type { ExerciseCreate } from '@/types/api';
import { Page } from '@/components/Page';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input, Textarea, Select } from '@/components/Input';
import { Field } from '@/components/Field';
import { Badge } from '@/components/Badge';
import { Modal } from '@/components/Modal';
import { Empty } from '@/components/Empty';
import { Skeleton } from '@/components/Skeleton';
import { difficultyLabels } from '@/utils/format';
import s from './Exercises.module.scss';

const Exercises = observer(() => {
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    exercisesStore.load();
  }, []);

  const items = exercisesStore.exercises;
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(e =>
      e.name.toLowerCase().includes(q) ||
      (e.muscle_group ?? '').toLowerCase().includes(q),
    );
  }, [search, items]);

  return (
    <Page
      title="Упражнения"
      subtitle={`Справочник: ${exercisesStore.exercises.length} шт.`}
      actions={
        <Button iconLeft={<Plus size={14} />} onClick={() => setCreating(true)}>
          Добавить
        </Button>
      }
    >
      <Card padding="compact">
        <div className={s.filters}>
          <div className={s.searchWrap}>
            <Input
              placeholder="Поиск по названию или группе мышц…"
              iconLeft={<Search size={14} />}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Select
            value={exercisesStore.filters.muscle_group ?? ''}
            onChange={e => exercisesStore.setFilter('muscle_group', e.target.value)}
          >
            <option value="">Все группы мышц</option>
            {exercisesStore.muscleGroups.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </Select>
          <Select
            value={exercisesStore.filters.load_type ?? ''}
            onChange={e => exercisesStore.setFilter('load_type', e.target.value)}
          >
            <option value="">Любой тип нагрузки</option>
            {exercisesStore.loadTypes.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
          <Select
            value={exercisesStore.filters.difficulty ?? ''}
            onChange={e => exercisesStore.setFilter('difficulty', e.target.value)}
          >
            <option value="">Любая сложность</option>
            <option value="easy">Лёгкое</option>
            <option value="medium">Среднее</option>
            <option value="hard">Сложное</option>
          </Select>
        </div>
      </Card>

      {exercisesStore.isLoading && exercisesStore.exercises.length === 0 ? (
        <div className={s.grid}>
          {[0, 1, 2, 3, 4, 5].map(i => (
            <Card key={i}><Skeleton height={80} /></Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card><Empty title="Ничего не найдено" description="Измените фильтры или добавьте упражнение" /></Card>
      ) : (
        <div className={s.grid}>
          {filtered.map(ex => (
            <Card key={ex.id} variant="data" padding="compact" className={s.exercise}>
              <div className={s.exerciseHead}>
                <div className={s.exerciseIcon}><Dumbbell size={16} /></div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className={s.exerciseName}>{ex.name}</div>
                  <div className={s.exerciseMeta}>
                    {ex.muscle_group && <Badge variant="info">{ex.muscle_group}</Badge>}
                    {ex.load_type && <Badge variant="secondary">{ex.load_type}</Badge>}
                    {ex.difficulty && (
                      <Badge variant={ex.difficulty === 'hard' ? 'danger' : ex.difficulty === 'easy' ? 'success' : 'warning'}>
                        {difficultyLabels[ex.difficulty] ?? ex.difficulty}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              {ex.equipment && (
                <div className={s.exerciseEquip}>{ex.equipment}</div>
              )}
              {ex.calories_per_minute !== null && (
                <div className={s.exerciseCals}>
                  ≈ {ex.calories_per_minute} ккал/мин
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <ExerciseCreateModal open={creating} onClose={() => setCreating(false)} />
    </Page>
  );
});

interface ModalProps {
  open: boolean;
  onClose: () => void;
}

function ExerciseCreateModal({ open, onClose }: ModalProps) {
  const [form, setForm] = useState<ExerciseCreate>({
    name: '',
    muscle_group: '',
    equipment: '',
    difficulty: 'medium',
    calories_per_minute: null,
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const id = await exercisesStore.create({
      ...form,
      muscle_group: form.muscle_group || null,
      equipment: form.equipment || null,
      description: form.description || null,
      calories_per_minute: form.calories_per_minute || null,
    });
    setSubmitting(false);
    if (id !== null) {
      setForm({ name: '', muscle_group: '', equipment: '', difficulty: 'medium', calories_per_minute: null, description: '' });
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Новое упражнение"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button form="ex-form" type="submit" loading={submitting}>Создать</Button>
        </>
      }
    >
      <form id="ex-form" onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <Field label="Название" required>
          <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
        </Field>
        <div className={s.formRow}>
          <Field label="Группа мышц">
            <Input value={form.muscle_group ?? ''} onChange={e => setForm({ ...form, muscle_group: e.target.value })} placeholder="Грудь, Спина…" />
          </Field>
          <Field label="Оборудование">
            <Input value={form.equipment ?? ''} onChange={e => setForm({ ...form, equipment: e.target.value })} placeholder="Штанга, Гантели…" />
          </Field>
        </div>
        <div className={s.formRow}>
          <Field label="Сложность">
            <Select value={form.difficulty ?? 'medium'} onChange={e => setForm({ ...form, difficulty: e.target.value })}>
              <option value="easy">Лёгкое</option>
              <option value="medium">Среднее</option>
              <option value="hard">Сложное</option>
            </Select>
          </Field>
          <Field label="Ккал/мин">
            <Input
              type="number"
              step="0.1"
              value={form.calories_per_minute ?? ''}
              onChange={e => setForm({ ...form, calories_per_minute: e.target.value ? Number(e.target.value) : null })}
            />
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
}

export default Exercises;
