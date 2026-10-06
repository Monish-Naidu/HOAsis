"use client";

import { useId, useState } from "react";
import type { SharedCostBill } from "@/lib/types";
import { formatDate, money, shortMoney } from "@/lib/utils";

/**
 * Two years of one provider's bills.
 *
 * Bars rather than a line, because these are discrete monthly invoices and a
 * line implies a reading between them that does not exist. The same month last
 * year is marked, since every utility is seasonal and that is the only honest
 * comparison.
 */
export function CostTrend({
  bills,
  peakCents,
  label,
}: {
  bills: SharedCostBill[];
  peakCents: number;
  label: string;
}) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);
  if (bills.length === 0) return null;

  const width = 720;
  const height = 132;
  const gap = 3;
  const barWidth = (width - gap * (bills.length - 1)) / bills.length;
  const scale = (cents: number) => (peakCents ? (cents / peakCents) * (height - 24) : 0);

  const active = hover === null ? null : bills[hover];
  const yearAgoIndex = bills.length - 13;

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full text-brand"
        role="img"
        aria-label={`${label}, ${formatDate(bills[0].periodStart, "short")} to ${formatDate(
          bills.at(-1)!.periodStart,
          "short",
        )}`}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.9" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.45" />
          </linearGradient>
        </defs>

        {bills.map((bill, index) => {
          const barHeight = Math.max(2, scale(bill.totalCents));
          const isActive = hover === index;
          const isYearAgo = index === yearAgoIndex;
          return (
            <rect
              key={bill.id}
              x={index * (barWidth + gap)}
              y={height - 20 - barHeight}
              width={barWidth}
              height={barHeight}
              rx={Math.min(3, barWidth / 2)}
              fill={`url(#${gradientId})`}
              opacity={isActive ? 1 : isYearAgo ? 0.85 : 0.62}
              stroke={isYearAgo ? "currentColor" : "none"}
              strokeWidth={isYearAgo ? 1 : 0}
              strokeDasharray={isYearAgo ? "2 2" : undefined}
              onMouseEnter={() => setHover(index)}
              className="transition-opacity duration-150"
            />
          );
        })}

        {/* Only the ends are labelled. A tick under every month is unreadable
            at this width and nobody reads them anyway. */}
        <text x={0} y={height - 6} className="fill-fg-subtle text-caption">
          {formatDate(bills[0].periodStart, "short")}
        </text>
        <text x={width} y={height - 6} textAnchor="end" className="fill-fg-subtle text-caption">
          {formatDate(bills.at(-1)!.periodStart, "short")}
        </text>
      </svg>

      <p className="tnum mt-1 min-h-[20px] text-footnote text-fg-muted">
        {active ? (
          <>
            <span className="font-semibold text-fg">{formatDate(active.periodStart, "medium")}</span>
            {" · "}
            {money(active.totalCents)} across {active.homes} homes
            {" · "}
            {money(active.averageShareCents)} a home
            {active.usageAmount ? ` · ${active.usageAmount.toLocaleString("en-US")} units` : ""}
          </>
        ) : (
          <>
            Peak {shortMoney(peakCents)}. Hover a month for the bill and what each home paid.
          </>
        )}
      </p>
    </div>
  );
}
