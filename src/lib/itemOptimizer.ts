import { Item } from "../App";

interface OptimizationResult {
  selected: Item[];
  totalMarketValue: number;
  totalBaseValue: number;
}

export const findOptimalItems = (
  items: Item[],
  targetValue: number = 400000,
  maxItems: number = 5
): OptimizationResult => {
  // Filter out items with no market value (avg24hPrice)
  const validItems = items.filter(
    (item) => item.quantity > 0 && item.avg24hPrice !== null
  );

  const threshold = targetValue;
  const maxThreshold = threshold + 5000; // Allow for some flexibility

  // Initialize DP arrays
  const dp: number[][] = Array(maxItems + 1)
    .fill(null)
    .map(() => Array(maxThreshold + 1).fill(Infinity));

  const itemTracking: number[][][] = Array(maxItems + 1)
    .fill(null)
    .map(() =>
      Array(maxThreshold + 1)
        .fill(null)
        .map(() => [])
    );

  // Base case
  dp[0][0] = 0;

  // Fill the DP table
  for (let c = 1; c <= maxItems; c++) {
    for (let i = 0; i < validItems.length; i++) {
      const item = validItems[i];
      const basePrice = item.basePrice;
      const marketPrice = item.avg24hPrice!; // We filtered null values

      for (let v = basePrice; v <= maxThreshold; v++) {
        if (dp[c - 1][v - basePrice] !== Infinity) {
          const newCost = dp[c - 1][v - basePrice] + marketPrice;
          if (newCost < dp[c][v]) {
            dp[c][v] = newCost;
            itemTracking[c][v] = [...itemTracking[c - 1][v - basePrice], i];
          }
        }
      }
    }
  }

  // Find valid combinations that meet the threshold
  const validCombinations: Array<{
    count: number;
    value: number;
    cost: number;
  }> = [];

  for (let c = 1; c <= maxItems; c++) {
    for (let v = threshold; v <= maxThreshold; v++) {
      if (dp[c][v] !== Infinity) {
        validCombinations.push({ count: c, value: v, cost: dp[c][v] });
      }
    }
  }

  // Sort by cost and randomly select one of the top 5 combinations
  validCombinations.sort((a, b) => a.cost - b.cost);
  const topCombinations = validCombinations.slice(
    0,
    Math.min(5, validCombinations.length)
  );
  const selectedCombination =
    topCombinations[Math.floor(Math.random() * topCombinations.length)];

  if (!selectedCombination) {
    return { selected: [], totalMarketValue: 0, totalBaseValue: 0 };
  }

  // Get the selected items
  const selectedIndices =
    itemTracking[selectedCombination.count][selectedCombination.value];
  const selectedItems = selectedIndices.map((index) => {
    const item = validItems[index];
    return { ...item, quantity: 1 }; // Set quantity to 1 for each selected item
  });

  // Calculate totals
  const totalMarketValue = selectedItems.reduce(
    (sum, item) => sum + (item.avg24hPrice || 0),
    0
  );
  const totalBaseValue = selectedItems.reduce(
    (sum, item) => sum + item.basePrice,
    0
  );

  return {
    selected: selectedItems,
    totalMarketValue,
    totalBaseValue,
  };
};