import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { observer } from 'mobx-react-lite';
import {
  Plus, Search, UserCheck, KeyRound, Copy, Check,
} from 'lucide-react';
import { trainersStore, usersStore } from '@/stores';
import type { Trainer, User } from '@/types/api';
import { Page } from '@/components/Page';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Field } from '@/components/Field';
import { Modal } from '@/components/Modal';
import { DataTable, type Column } from '@/components/DataTable';
import { Badge } from '@/components/Badge';
import { api, ApiError } from '@/utils/api';
import { toastStore } from '@/stores/ToastStore';
import s from './TrainersAccounts.module.scss';

interface TrainerAccount {
  trainer: Trainer;
  user: User | undefined;
}

const TrainersAccounts = observer(() => {
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{
    login: string;
    password: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    trainersStore.load();
    usersStore.load();
  }, []);

  const accounts = useMemo<TrainerAccount[]>(() => {
    const userMap = new Map<number, User>();
    for (const u of usersStore.users) {
      if (u.trainer_id != null) {
        userMap.set(u.trainer_id, u);
      }
    }
    return trainersStore.trainers
      .filter(t => !!t.is_active)
      .map(t => ({ trainer: t, user: userMap.get(t.id) }))
      .filter(a => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          a.trainer.name.toLowerCase().includes(q) ||
          a.user?.login.toLowerCase().includes(q) ||
          (a.trainer.specialization ?? '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.trainer.id - b.trainer.id);
  }, [trainersStore.trainers, usersStore.users, search]);

  const columns: Column<TrainerAccount>[] = [
    {
      key: 'name',
      header: 'Тренер',
      cell: a => (
        <div className={s.nameCell}>
          <span className={s.nameMain}>{a.trainer.name}</span>
          <span className={s.nameSub}>{a.trainer.specialization || '—'}</span>
        </div>
      ),
    },
    {
      key: 'exp',
      header: 'Стаж',
      width: '100px',
      cell: a => `${a.trainer.experience_years ?? 0} лет`,
    },
    {
      key: 'rating',
      header: 'Рейтинг',
      width: '90px',
      cell: a => (
        <Badge variant={a.trainer.rating >= 4.5 ? 'success' : 'info'}>
          {a.trainer.rating.toFixed(1)}
        </Badge>
      ),
    },
    {
      key: 'login',
      header: 'Логин',
      width: '140px',
      mono: true,
      cell: a =>
        a.user ? (
          <span className={s.login}>{a.user.login}</span>
        ) : (
          <Badge variant="warning" size="sm">Нет аккаунта</Badge>
        ),
    },
    {
      key: 'status',
      header: 'Статус',
      width: '110px',
      cell: a => {
        const isActive = !!a.user?.is_active;
        return (
          <Badge variant={isActive ? 'success' : 'neutral'} size="sm">
            {isActive ? 'Активен' : 'Деактив.'}
          </Badge>
        );
      },
    },
    {
      key: 'icon',
      header: '',
      width: '40px',
      align: 'right',
      cell: () => <UserCheck size={14} className={s.arrow} />,
    },
  ];

  return (
    <Page
      title="Аккаунты тренеров"
      subtitle={`Всего: ${accounts.length} шт.`}
      actions={
        <Button
          iconLeft={<Plus size={14} />}
          onClick={() => setCreating(true)}
        >
          Добавить тренера
        </Button>
      }
    >
      <Card padding="compact">
        <div className={s.filters}>
          <div className={s.searchWrap}>
            <Input
              placeholder="Поиск по имени, логину или специализации…"
              iconLeft={<Search size={14} />}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </Card>

      <Card padding="none">
        <DataTable
          columns={columns}
          rows={accounts}
          rowKey={a => a.trainer.id}
          loading={trainersStore.isLoading || usersStore.isLoading}
          emptyTitle="Нет тренеров"
          emptyDescription="Добавьте первого тренера и выдайте ему аккаунт"
        />
      </Card>

      {createdCredentials && (
        <CredentialsModal
          credentials={createdCredentials}
          onClose={() => setCreatedCredentials(null)}
        />
      )}

      <TrainerCreateModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(login, password, name) => {
          setCreating(false);
          setCreatedCredentials({ login, password, name });
          trainersStore.load();
          usersStore.load();
        }}
      />
    </Page>
  );
});

interface CredentialsModalProps {
  credentials: { login: string; password: string; name: string };
  onClose: () => void;
}

function CredentialsModal({ credentials, onClose }: CredentialsModalProps) {
  const [copied, setCopied] = useState(false);

  const copyAll = () => {
    const text = `Тренер: ${credentials.name}\nЛогин: ${credentials.login}\nПароль: ${credentials.password}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Аккаунт создан"
      size="sm"
      footer={
        <Button onClick={onClose}>Закрыть</Button>
      }
    >
      <div className={s.credentials}>
        <p className={s.credentialsHint}>
          Сохраните учётные данные — пароль больше не будет отображаться.
        </p>

        <div className={s.credRow}>
          <span className={s.credLabel}>Тренер</span>
          <span className={s.credValue}>{credentials.name}</span>
        </div>
        <div className={s.credRow}>
          <span className={s.credLabel}>Логин</span>
          <span className={s.credValue}>{credentials.login}</span>
        </div>
        <div className={s.credRow}>
          <span className={s.credLabel}>Пароль</span>
          <span className={s.credValue}>{credentials.password}</span>
        </div>

        <Button
          variant="secondary"
          iconLeft={copied ? <Check size={14} /> : <Copy size={14} />}
          onClick={copyAll}
          className={s.copyBtn}
        >
          {copied ? 'Скопировано' : 'Копировать данные'}
        </Button>
      </div>
    </Modal>
  );
}

interface CreateModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (login: string, password: string, name: string) => void;
}

function TrainerCreateModal({ open, onClose, onCreated }: CreateModalProps) {
  const [name, setName] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [experience, setExperience] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [autoLogin, setAutoLogin] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const generateLogin = (n: string) => {
    const base = n.toLowerCase().replace(/[^a-zа-яё]/gi, '');
    if (!base) return '';
    const translit: Record<string, string> = {
      а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'zh',з:'z',и:'i',
      й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',
      у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',
      ь:'',э:'e',ю:'yu',я:'ya',
    };
    return base.split('').map(c => translit[c] ?? c).join('');
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (autoLogin) {
      const base = generateLogin(value);
      if (base) setLogin(base);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name || !login || !password) return;
    setSubmitting(true);

    try {
      // 1. Создаём тренера
      const trainerRes = await api.post<{ id: number; message: string }>('/trainers', {
        name,
        specialization: specialization || null,
        experience_years: experience ? parseInt(experience, 10) : null,
      });

      // 2. Создаём пользователя
      await api.post('/users', {
        login,
        password,
        role: 'trainer',
        full_name: name,
        trainer_id: trainerRes.id,
      });

      toastStore.add('Тренер и аккаунт созданы', 'success');
      onCreated(login, password, name);
      setName('');
      setSpecialization('');
      setExperience('');
      setLogin('');
      setPassword('');
    } catch (e) {
      const message = e instanceof ApiError ? e.detail : 'Ошибка создания';
      toastStore.add(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Новый тренер"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button form="trainer-form" type="submit" loading={submitting}>
            Создать аккаунт
          </Button>
        </>
      }
    >
      <form id="trainer-form" className={s.form} onSubmit={handleSubmit}>
        <div className={s.formGrid}>
          <Field label="ФИО" required>
            <Input
              value={name}
              onChange={e => handleNameChange(e.target.value)}
              required
            />
          </Field>
          <Field label="Специализация">
            <Input
              value={specialization}
              onChange={e => setSpecialization(e.target.value)}
            />
          </Field>
          <Field label="Стаж (лет)">
            <Input
              type="number"
              min={0}
              value={experience}
              onChange={e => setExperience(e.target.value)}
            />
          </Field>
        </div>

        <div className={s.accountBlock}>
          <div className={s.accountTitle}>
            <KeyRound size={14} />
            <span>Учётные данные</span>
          </div>
          <label className={s.autoLogin}>
            <input
              type="checkbox"
              checked={autoLogin}
              onChange={e => setAutoLogin(e.target.checked)}
            />
            Автоматически формировать логин из ФИО
          </label>
          <div className={s.formGrid}>
            <Field label="Логин" required>
              <Input
                value={login}
                onChange={e => {
                  setAutoLogin(false);
                  setLogin(e.target.value);
                }}
                required
              />
            </Field>
            <Field label="Пароль" required>
              <Input
                type="text"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </Field>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export default TrainersAccounts;
