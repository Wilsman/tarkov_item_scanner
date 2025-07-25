export type LootThreshold = 'very_low' | 'low' | 'medium' | 'high' | 'very_high' | 'premium' | 'quest';

export const THRESHOLD_CONFIG = {
  very_low: { maxValue: 10000, time: 2, label: 'Very Low (0-10,000₽) - 2 hours' },
  low: { minValue: 10001, maxValue: 25000, time: 3, label: 'Low (10,001-25,000₽) - 3 hours' },
  medium: { minValue: 25001, maxValue: 50000, time: 4, label: 'Medium (25,001-50,000₽) - 4 hours' },
  high: { minValue: 50001, maxValue: 100000, time: 5, label: 'High (50,001-100,000₽) - 5 hours' },
  very_high: { minValue: 100001, maxValue: 200000, time: 8, label: 'Very High (100,001-200,000₽) - 8 hours' },
  premium: { minValue: 200001, maxValue: 399999, time: 12, label: 'High Value Items (200,001-399,999₽) - 12 hours' },
  quest: { minValue: 400000, time: 14, chance: 0.25, altTime: 6, label: 'Quest/Hideout (400,000₽+) - 14h or 25% 6h' }
} as const;
