import type { ReactNode } from 'react';
import { Card } from './Card';

interface ChartCardProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  height?: number;
  children: ReactNode;
}

export function ChartCard({ title, subtitle, actions, height = 320, children }: ChartCardProps) {
  return (
    <Card title={title} subtitle={subtitle} actions={actions}>
      <div style={{ width: '100%', height }}>
        {children}
      </div>
    </Card>
  );
}
