import NumberFlow from '@number-flow/react';
import type { ChallengeMetric, Units } from '@pacer/shared';
import { metricParts } from './format';

// Odometer-style metric value (spec design direction #5: numbers that roll over
// make stats feel alive). The number animates via NumberFlow; the unit suffix
// stays static so "12.4 km" reads cleanly while only the digits move.

interface AnimatedMetricProps {
  value: number;
  metric: ChallengeMetric;
  units: Units;
  className?: string;
}

export function AnimatedMetric({ value, metric, units, className }: AnimatedMetricProps) {
  const { value: v, decimals, suffix } = metricParts(value, metric, units);
  return (
    <span className={className}>
      <NumberFlow
        value={v}
        format={{ minimumFractionDigits: decimals, maximumFractionDigits: decimals }}
      />
      <span className="ml-1 text-ink-muted font-medium">{suffix}</span>
    </span>
  );
}
