import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react';
import s from './Input.module.scss';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
  iconLeft?: ReactNode;
};

export function Input({ invalid, iconLeft, className = '', ...rest }: InputProps) {
  if (iconLeft) {
    return (
      <span className={`${s.wrapper} ${invalid ? s.invalid : ''} ${className}`}>
        <span className={s.icon}>{iconLeft}</span>
        <input className={`${s.control} ${s.controlPadded}`} {...rest} />
      </span>
    );
  }
  return (
    <input
      className={`${s.control} ${invalid ? s.invalid : ''} ${className}`}
      {...rest}
    />
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
};

export function Textarea({ invalid, className = '', rows = 3, ...rest }: TextareaProps) {
  return (
    <textarea
      className={`${s.control} ${s.textarea} ${invalid ? s.invalid : ''} ${className}`}
      rows={rows}
      {...rest}
    />
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean;
};

export function Select({ invalid, className = '', children, ...rest }: SelectProps) {
  return (
    <span className={`${s.selectWrapper} ${invalid ? s.invalid : ''} ${className}`}>
      <select className={s.select} {...rest}>
        {children}
      </select>
    </span>
  );
}
