import type { ReactNode } from 'react';
import s from './Field.module.scss';

interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
}

export function Field({ label, hint, error, required, children }: FieldProps) {
  return (
    <label className={s.field}>
      {label && (
        <span className={s.label}>
          {label}
          {required && <span className={s.required} aria-hidden="true">*</span>}
        </span>
      )}
      {children}
      {error
        ? <span className={s.error}>{error}</span>
        : hint && <span className={s.hint}>{hint}</span>}
    </label>
  );
}
