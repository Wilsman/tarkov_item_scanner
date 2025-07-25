export type LootThreshold = 'normal' | 'high' | 'quest';

export const THRESHOLD_CONFIG = {
  normal: { maxValue: 350000, time: 12, label: 'Normal Loot (under 350,001₽)' },
  high: { maxValue: 399999, time: 14, label: 'High Value (350,001₽ - 399,999₽)' },
  quest: { 
    minValue: 400000, 
    time: 14, 
    chance: 0.25, 
    altTime: 6, 
    label: 'Quest/Hideout (400,000₽+)' 
  }
} as const;
