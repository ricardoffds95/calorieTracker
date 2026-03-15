import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { format, subDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useFood } from '../../hooks/useFood';
import { useDailyGoals } from '../../hooks/useDailyGoals';
import { Colors, Typography, FontWeight, Spacing, Radius, Shadow } from '../../constants/theme';
import { MacroColors } from '../../constants/theme';

function BarChart({ data, goal }: { data: { date: string; calories: number }[]; goal: number }) {
  const maxVal = Math.max(goal, ...data.map((d) => d.calories), 1);

  return (
    <View style={chartStyles.container}>
      {data.map((d, i) => {
        const pct = d.calories / maxVal;
        const isGoalHit = d.calories >= goal * 0.9 && d.calories <= goal * 1.1;
        const label = format(parseISO(d.date), 'EEE', { locale: ptBR });

        return (
          <View key={i} style={chartStyles.barCol}>
            <Text style={chartStyles.barValue}>
              {d.calories > 0 ? d.calories : ''}
            </Text>
            <View style={chartStyles.barTrack}>
              <View
                style={[
                  chartStyles.barFill,
                  {
                    height: `${Math.min(pct * 100, 100)}%`,
                    backgroundColor: isGoalHit
                      ? Colors.accent
                      : d.calories > goal * 1.1
                      ? Colors.accent2
                      : Colors.accent4,
                  },
                ]}
              />
              {/* Goal line */}
              <View
                style={[
                  chartStyles.goalLine,
                  { bottom: `${(goal / maxVal) * 100}%` },
                ]}
              />
            </View>
            <Text style={chartStyles.barLabel}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const chartStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 140,
    alignItems: 'flex-end',
    gap: 6,
    paddingTop: 20,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  barValue: {
    fontSize: 9,
    color: Colors.textDisabled,
    marginBottom: 2,
  },
  barTrack: {
    width: '100%',
    flex: 1,
    backgroundColor: Colors.surface2,
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
    borderRadius: 4,
    minHeight: 2,
  },
  goalLine: {
    position: 'absolute',
    width: '100%',
    height: 1,
    backgroundColor: Colors.accent + '60',
  },
  barLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 4,
    textTransform: 'capitalize',
  },
});

export default function HistoryScreen() {
  const { logs, getDayTotals } = useFood();
  const { goals } = useDailyGoals();

  const last7Days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd');
      const totals = getDayTotals(date);
      return { date, ...totals };
    });
  }, [logs]);

  const avgCalories = useMemo(() => {
    const days = last7Days.filter((d) => d.calories > 0);
    if (!days.length) return 0;
    return Math.round(days.reduce((s, d) => s + d.calories, 0) / days.length);
  }, [last7Days]);

  const streak = useMemo(() => {
    let count = 0;
    for (let i = 0; i < 30; i++) {
      const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
      const totals = getDayTotals(date);
      const hit =
        totals.calories >= goals.calories * 0.85 &&
        totals.calories <= goals.calories * 1.15;
      if (hit) count++;
      else break;
    }
    return count;
  }, [logs, goals]);

  const chartData = last7Days.map((d) => ({ date: d.date, calories: d.calories }));

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Histórico</Text>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatCard
            emoji="🔥"
            label="Sequência"
            value={streak.toString()}
            unit="dias"
            color={Colors.accent2}
          />
          <StatCard
            emoji="📊"
            label="Média semanal"
            value={avgCalories.toString()}
            unit="kcal/dia"
            color={Colors.accent}
          />
          <StatCard
            emoji="🎯"
            label="Objetivo"
            value={goals.calories.toString()}
            unit="kcal"
            color={Colors.accent4}
          />
        </View>

        {/* Weekly bar chart */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Calorias — últimos 7 dias</Text>
          <BarChart data={chartData} goal={goals.calories} />
          <View style={styles.legendRow}>
            <LegendDot color={Colors.accent} label="No objetivo" />
            <LegendDot color={Colors.accent4} label="Abaixo" />
            <LegendDot color={Colors.accent2} label="Acima" />
          </View>
        </View>

        {/* Macro breakdown */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Média de macros esta semana</Text>
          {(() => {
            const days = last7Days.filter((d) => d.calories > 0);
            const n = days.length || 1;
            const avg = {
              protein: Math.round(days.reduce((s, d) => s + d.protein, 0) / n),
              carbs: Math.round(days.reduce((s, d) => s + d.carbs, 0) / n),
              fat: Math.round(days.reduce((s, d) => s + d.fat, 0) / n),
            };
            return (
              <View style={styles.macroBreakdown}>
                <MacroAvgRow label="Proteína" value={avg.protein} goal={goals.protein} color={MacroColors.protein} />
                <MacroAvgRow label="Hidratos" value={avg.carbs} goal={goals.carbs} color={MacroColors.carbs} />
                <MacroAvgRow label="Gordura" value={avg.fat} goal={goals.fat} color={MacroColors.fat} />
              </View>
            );
          })()}
        </View>

        {/* Past days list */}
        <Text style={styles.cardTitle}>Dias anteriores</Text>
        {[...last7Days].reverse().map((day) => (
          <DaySummaryRow key={day.date} day={day} goal={goals.calories} />
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ emoji, label, value, unit, color }: { emoji: string; label: string; value: string; unit: string; color: string }) {
  return (
    <View style={[statStyles.card, { borderColor: color + '30' }]}>
      <Text style={statStyles.emoji}>{emoji}</Text>
      <Text style={[statStyles.value, { color }]}>{value}</Text>
      <Text style={statStyles.unit}>{unit}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    ...Shadow.sm,
  },
  emoji: { fontSize: 24, marginBottom: 4 },
  value: { fontSize: Typography.xl, fontWeight: FontWeight.bold },
  unit: { fontSize: Typography.xs, color: Colors.textMuted },
  label: { fontSize: Typography.xs, color: Colors.textDisabled, marginTop: 2, textAlign: 'center' },
});

function MacroAvgRow({ label, value, goal, color }: { label: string; value: number; goal: number; color: string }) {
  const pct = goal > 0 ? Math.min(value / goal, 1) : 0;
  return (
    <View style={{ gap: 4, marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: Colors.textMuted, fontSize: Typography.sm }}>{label}</Text>
        <Text style={{ color, fontSize: Typography.sm, fontWeight: FontWeight.semibold }}>
          {value}g <Text style={{ color: Colors.textDisabled }}>/ {goal}g</Text>
        </Text>
      </View>
      <View style={{ height: 5, backgroundColor: Colors.surface2, borderRadius: 3, overflow: 'hidden' }}>
        <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: color, borderRadius: 3 }} />
      </View>
    </View>
  );
}

function DaySummaryRow({ day, goal }: { day: { date: string; calories: number; protein: number; carbs: number; fat: number }; goal: number }) {
  const isToday = day.date === format(new Date(), 'yyyy-MM-dd');
  const label = isToday ? 'Hoje' : format(parseISO(day.date), "EEEE, d MMM", { locale: ptBR });
  const pct = goal > 0 ? Math.min(day.calories / goal, 1) : 0;
  const hitGoal = day.calories >= goal * 0.85 && day.calories <= goal * 1.15;

  return (
    <View style={dayStyles.row}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={[dayStyles.label, isToday && { color: Colors.accent }]}>{label}</Text>
          <Text style={[dayStyles.cals, hitGoal && { color: Colors.accent }]}>
            {day.calories > 0 ? `${day.calories} kcal` : '—'}
          </Text>
        </View>
        {day.calories > 0 && (
          <View style={{ height: 4, backgroundColor: Colors.surface2, borderRadius: 2, overflow: 'hidden' }}>
            <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: hitGoal ? Colors.accent : Colors.accent4, borderRadius: 2 }} />
          </View>
        )}
      </View>
    </View>
  );
}

const dayStyles = StyleSheet.create({
  row: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.xs,
    ...Shadow.sm,
  },
  label: {
    fontSize: Typography.sm,
    color: Colors.text,
    fontWeight: FontWeight.medium,
    textTransform: 'capitalize',
  },
  cals: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
    fontWeight: FontWeight.semibold,
  },
});

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ fontSize: 11, color: Colors.textMuted }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { paddingHorizontal: Spacing.md, paddingTop: Spacing.lg },
  title: {
    fontSize: Typography.xxl,
    color: Colors.text,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadow.sm,
  },
  cardTitle: {
    fontSize: Typography.base,
    color: Colors.text,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.md,
  },
  legendRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: Spacing.sm,
  },
  macroBreakdown: { gap: 4 },
});
