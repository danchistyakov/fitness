import s from './Skeleton.module.scss';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  className?: string;
}

export function Skeleton({ width = '100%', height = 16, radius = 6, className = '' }: SkeletonProps) {
  const w = typeof width === 'number' ? `${width}px` : width;
  const h = typeof height === 'number' ? `${height}px` : height;
  const r = typeof radius === 'number' ? `${radius}px` : radius;
  return <span className={`${s.skeleton} ${className}`} style={{ width: w, height: h, borderRadius: r }} />;
}

interface SkeletonRowsProps {
  rows?: number;
  height?: number;
  gap?: number;
}

export function SkeletonRows({ rows = 4, height = 20, gap = 12 }: SkeletonRowsProps) {
  return (
    <div className={s.rows} style={{ gap: `${gap}px` }}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={height} width={i === rows - 1 ? '60%' : '100%'} />
      ))}
    </div>
  );
}
