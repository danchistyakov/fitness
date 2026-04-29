import type { ReactNode } from 'react';
import s from './DataTable.module.scss';
import { SkeletonRows } from './Skeleton';
import { Empty } from './Empty';

export interface Column<T> {
  key: string;
  header: ReactNode;
  width?: string;
  align?: 'left' | 'right' | 'center';
  cell: (row: T) => ReactNode;
  mono?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  emptyTitle = 'Нет данных',
  emptyDescription,
  onRowClick,
}: DataTableProps<T>) {
  if (loading && rows.length === 0) {
    return <div className={s.skeleton}><SkeletonRows rows={6} height={28} /></div>;
  }

  if (!loading && rows.length === 0) {
    return <Empty title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className={s.wrapper}>
      <table className={s.table}>
        <thead>
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                style={{ width: col.width, textAlign: col.align ?? 'left' }}
                className={s.headCell}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className={onRowClick ? s.rowClickable : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map(col => (
                <td
                  key={col.key}
                  style={{ textAlign: col.align ?? 'left' }}
                  className={`${s.bodyCell} ${col.mono ? s.mono : ''}`}
                >
                  {col.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
