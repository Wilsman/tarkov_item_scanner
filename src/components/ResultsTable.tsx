import React from "react";
import { ArrowUpDown } from "lucide-react";
import { Item } from "../App";
import { ignoreList } from "../data/ignore_list";

interface ResultsTableProps {
  items: Item[];
  sortConfig: {
    key: keyof Item | null;
    direction: "ascending" | "descending";
  };
  requestSort: (key: string) => void;
}

const ResultsTable: React.FC<ResultsTableProps> = ({
  items,
  // sortConfig,
  requestSort,
}) => {
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalValue = items.reduce(
    (sum, item) => sum + item.basePrice * item.quantity,
    0
  );
  const totalCost = items.reduce(
    (sum, item) => sum + (item.avg24hPrice || 0) * item.quantity,
    0
  );

  return (
    <div>
      <div className="overflow-y-auto max-h-[60vh]">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-white dark:bg-gray-800">
            <tr>
              <th
                className="px-4 py-2 text-left cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => requestSort("name")}
              >
                <div className="flex items-center">
                  Item Name
                  <ArrowUpDown className="ml-1 h-4 w-4" />
                </div>
              </th>
              <th
                className="px-4 py-2 text-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => requestSort("quantity")}
              >
                <div className="flex items-center justify-center">
                  Quantity
                  <ArrowUpDown className="ml-1 h-4 w-4" />
                </div>
              </th>
              <th
                className="px-4 py-2 text-right cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => requestSort("basePrice")}
              >
                <div className="flex items-center justify-end">
                  Base Price (₽)
                  <ArrowUpDown className="ml-1 h-4 w-4" />
                </div>
              </th>
              <th
                className="px-4 py-2 text-right cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => requestSort("avg24hPrice")}
              >
                <div className="flex items-center justify-end">
                  Avg 24h Price (₽)
                  <ArrowUpDown className="ml-1 h-4 w-4" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr
                key={index}
                className={`${
                  index % 2 === 0
                    ? "bg-gray-50 dark:bg-gray-700"
                    : "bg-white dark:bg-gray-800"
                }`}
              >
                <td
                  className={`border border-gray-200 dark:border-gray-700 px-4 py-2 ${
                    ignoreList.includes(item.name)
                      ? "text-red-500 line-through"
                      : ""
                  }`}
                >
                  {item.name}
                </td>
                <td className="border border-gray-200 dark:border-gray-700 px-4 py-2 text-center">
                  x{item.quantity}
                </td>
                <td className="border border-gray-200 dark:border-gray-700 px-4 py-2 text-right">
                  {item.basePrice.toLocaleString()}
                </td>
                <td className="border border-gray-200 dark:border-gray-700 px-4 py-2 text-right">
                  {item.avg24hPrice !== null
                    ? item.avg24hPrice.toLocaleString()
                    : "N/A"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Summary
        </h2>
        <p className="font-medium text-gray-900 dark:text-white">
          Total Items: {totalItems}
        </p>
        <p className="font-medium text-gray-900 dark:text-white">
          Total Value: {totalValue.toLocaleString()} ₽
        </p>
        <p className="font-medium text-gray-900 dark:text-white">
          Total Cost: {totalCost.toLocaleString()} ₽
        </p>
        <p className="text-sm mt-2 text-gray-600 dark:text-gray-400">
          Note: Some items may have a base price of 0 as they were not found in
          the database or have special values.
        </p>
      </div>
    </div>
  );
};

export default ResultsTable;
