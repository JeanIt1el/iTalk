import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import type { DailyActivity, SkillScore } from '@/types/learning';
import { SKILL_LABELS } from '@/lib/constants';

interface WeeklyActivityChartProps {
  data: DailyActivity[];
}

export function WeeklyActivityChart({ data }: WeeklyActivityChartProps) {
  const chartData = data.map((d) => ({
    day: new Date(d.date).toLocaleDateString('fr', { weekday: 'short' }),
    minutes: d.minutes,
  lessons: d.lessonsCompleted,
  skill: d.skill,
  fill: d.minutes > 0 ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
  }));
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '0.75rem',
            fontSize: '0.75rem',
          }}
          labelStyle={{ color: 'hsl(var(--foreground))' }}
        />
        <Bar dataKey="minutes" radius={[6, 6, 0, 0]}>
          {chartData.map((entry, idx) => (
            <Cell key={idx} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

interface SkillRadialChartProps {
  skills: SkillScore[];
}

export function SkillRadialChart({ skills }: SkillRadialChartProps) {
  const data = skills.map((s) => ({
    name: SKILL_LABELS[s.skill] ?? s.skill,
    score: s.score,
    fill: s.score >= 80 ? 'hsl(var(--success))' : s.score >= 60 ? 'hsl(var(--primary))' : s.score >= 40 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))',
  }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <RadialBarChart innerRadius="25%" outerRadius="100%" data={data} startAngle={90} endAngle={-270}>
        <PolarAngleAxis dataKey="score" domain={[0, 100]} tick={false} />
        <RadialBar dataKey="score" cornerRadius={8} background={{ fill: 'hsl(var(--muted))' }} />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '0.75rem',
            fontSize: '0.75rem',
          }}
        />
      </RadialBarChart>
    </ResponsiveContainer>
  );
}

interface CEFRProgressChartProps {
  data: { date: string; level: string; score: number }[];
}

export function CEFRProgressChart({ data }: CEFRProgressChartProps) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id="cefrGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '0.75rem',
            fontSize: '0.75rem',
          }}
        />
        <Area type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#cefrGradient)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
