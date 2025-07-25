// itemOptimizer.ts
import { Item } from "../App";

interface OptimizationResult {
  selected: Item[];
  totalMarketValue: number;
  totalBaseValue: number;
}

export const findOptimalItems = (
  items: Item[],
  targetValue: number,
  maxItems: number = 5
): OptimizationResult => {
  // Filter out items with no market value (avg24hPrice)
  const validItems = items.filter(
    (item) => item.quantity > 0 && item.avg24hPrice !== null
  );

  // Expand valid items based on available quantity.
  // Limit each item to a maximum of 'maxItems' copies since we cannot select more than that.
  const expandedItems: Item[] = [];
  for (const item of validItems) {
    const copies = Math.min(item.quantity, maxItems);
    for (let i = 0; i < copies; i++) {
      // Each copy is considered as a unique instance with quantity = 1
      expandedItems.push({ ...item, quantity: 1 });
    }
  }

  const threshold = targetValue;
  const maxThreshold = threshold + 5000; // Allow for some flexibility

  // Initialize DP arrays.
  // dp[c][v] holds the minimal market cost for a combination of c items that sum to base value v.
  const dp: number[][] = Array(maxItems + 1)
    .fill(null)
    .map(() => Array(maxThreshold + 1).fill(Infinity));

  // itemTracking[c][v] holds the indices (in expandedItems) used to form that combination.
  const itemTracking: number[][][] = Array(maxItems + 1)
    .fill(null)
    .map(() =>
      Array(maxThreshold + 1)
        .fill(null)
        .map(() => [] as number[])
    );

  // Base case: 0 items with 0 value costs 0.
  dp[0][0] = 0;

  // Fill the DP table using expandedItems.
  for (let c = 1; c <= maxItems; c++) {
    for (let i = 0; i < expandedItems.length; i++) {
      const item = expandedItems[i];
      const basePrice = item.basePrice;
      const marketPrice = item.avg24hPrice!; // Guaranteed non-null after filtering

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

  // Collect valid combinations that meet the threshold.
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

  // Sort by cost and randomly select one of the top 5 combinations.
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

  // Get the selected copies from expandedItems.
  const selectedIndices =
    itemTracking[selectedCombination.count][selectedCombination.value];
  const selectedCopies = selectedIndices.map((index) => expandedItems[index]);

  // Group copies by item id so that the same item is not listed more times than available.
  const groupedItems: { [id: string]: Item } = {};
  for (const copy of selectedCopies) {
    if (groupedItems[copy.id]) {
      groupedItems[copy.id].quantity += 1;
    } else {
      groupedItems[copy.id] = { ...copy };
    }
  }
  const selectedItems = Object.values(groupedItems);

  // Calculate totals based on the grouped items.
  const totalMarketValue = selectedItems.reduce(
    (sum, item) => sum + (item.avg24hPrice || 0) * item.quantity,
    0
  );
  const totalBaseValue = selectedItems.reduce(
    (sum, item) => sum + item.basePrice * item.quantity,
    0
  );

  return {
    selected: selectedItems,
    totalMarketValue,
    totalBaseValue,
  };
};

export default findOptimalItems;
