'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MonthlyPoint } from '@/server/services/dashboard';
import { formatInt, formatYen } from '@/lib/format';

const AXIS = { stroke: '#98a2b3', fontSize: 11 } as const;

export function MonthlyContractsChart({ data }: { data: MonthlyPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="#eaecf0" vertical={false} />
        <XAxis dataKey="month" tick={AXIS} tickLine={false} axisLine={{ stroke: '#e4e7ec' }} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} />
        <Tooltip
          formatter={(value) => [formatInt(Number(value ?? 0)), '契約件数']}
          contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e4e7ec' }}
        />
        <Bar dataKey="contracts" name="契約件数" fill="#1a56db" radius={[2, 2, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MonthlyRevenueChart({ data, showHqFinancials }: { data: MonthlyPoint[]; showHqFinancials: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="#eaecf0" vertical={false} />
        <XAxis dataKey="month" tick={AXIS} tickLine={false} axisLine={{ stroke: '#e4e7ec' }} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={64} tickFormatter={(v: number) => `${Math.round(v / 10000)}万`} />
        <Tooltip
          formatter={(value, name) => [formatYen(Number(value ?? 0)), String(name ?? '')]}
          contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e4e7ec' }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {showHqFinancials ? (
          <Bar dataKey="hqRevenue" name="VIRTUE売上" fill="#1a56db" radius={[2, 2, 0, 0]} maxBarSize={28} />
        ) : null}
        <Bar dataKey="agencyPayout" name="代理店支払" fill="#98a2b3" radius={[2, 2, 0, 0]} maxBarSize={28} />
        {showHqFinancials ? (
          <Line dataKey="hqGrossProfit" name="VIRTUE粗利" stroke="#067647" strokeWidth={2} dot={false} />
        ) : null}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
