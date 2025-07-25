export type LootThreshold = 'high-value' | 'quest';

export const THRESHOLD_CONFIG = {
  'high-value': { minValue: 350001, maxValue: 399999, time: 12, label: 'High Value Items (350,001-399,999₽) - 12 hours' },
  'quest': { minValue: 400000, time: 14, chance: 0.25, altTime: 6, label: 'Quest/Hideout (400,000₽+) - 14h or 25% 6h' }
} as const;
