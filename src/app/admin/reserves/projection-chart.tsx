"use client";

import { useId, useState } from "react";
import type { Projection } from "@/lib/reserves";
import { money, shortMoney } from "@/lib/utils";

/**
 * The reserve balance over the projection.
 *
 * Inline SVG rather than a charting library: one series, one baseline, and a
 * few markers do not justify the dependency or the bundle. Values below zero
 * are drawn in red beneath the axis, because a board should be able to see the
 * shortfall from across the room without reading a single number.
 */
export function ProjectionChart({ projection }: { projection: Projection }) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);

  const width = 720;
  const height = 220;
  const padding = { top: 12, right: 8, bottom: 22, left: 8 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const values = projection.years.map((year) => year.closingCents);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;

  const x = (index: number) =>
    padding.left + (index / Math.max(1, projection.years.length - 1)) * plotWidth;
  const y = (value: number) => padding.top + ((max - value) / span) * plotHeight;

  const line = projection.years
    .map((year, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(year.closingCents)}`)
    .join(" ");
  const area = `${line} L${x(projection.years.length - 1)},${y(min)} L${x(0)},${y(min)} Z`;

  const active = hover === null ? null : projection.years[hover];

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label={`Reserve balance from ${projection.years[0]?.year} to ${projection.years.at(-1)?.year}`}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Zero line. Everything below it is money the association does not have. */}
        <line
          x1={padding.left}
          x2={width - padding.right}
          y1={y(0)}
          y2={y(0)}
          className="stroke-border"
          strokeWidth="1"
        />
        {min < 0 ? (
          <rect
            x={padding.left}
            y={y(0)}
            width={plotWidth}
            height={Math.max(0, y(min) - y(0))}
            className="fill-danger"
            opacity="0.07"
          />
        ) : null}

        <path d={area} fill={`url(#${gradientId})`} className="text-navy-600 dark:text-navy-300" />
        <path
          d={line}
          fill="none"
          strokeWidth="2"
          strokeLinejoin="round"
          className="stroke-navy-700 dark:stroke-navy-200"
        />

        {/* A dot on every year a component is replaced. */}
        {projection.years.map((year, index) =>
          year.expenditures.length ? (
            <circle
              key={year.year}
              cx={x(index)}
              cy={y(year.closingCents)}
              r="3"
              className={year.isShortfall ? "fill-danger" : "fill-warn"}
            />
          ) : null,
        )}

        {/* Invisible hit targets, so hover works without a library. */}
        {projection.years.map((year, index) => (
          <rect
            key={`hit-${year.year}`}
            x={x(index) - plotWidth / projection.years.length / 2}
            y={padding.top}
            width={plotWidth / projection.years.length}
            height={plotHeight}
            fill="transparent"
            onMouseEnter={() => setHover(index)}
          />
        ))}

        {active ? (
          <line
            x1={x(hover!)}
            x2={x(hover!)}
            y1={padding.top}
            y2={padding.top + plotHeight}
            className="stroke-fg-subtle"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        ) : null}

        <text x={padding.left} y={height - 6} className="fill-fg-subtle text-[11px]">
          {projection.years[0]?.year}
        </text>
        <text
          x={width - padding.right}
          y={height - 6}
          textAnchor="end"
          className="fill-fg-subtle text-[11px]"
        >
          {projection.years.at(-1)?.year}
        </text>
      </svg>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-[12px]">
        {active ? (
          <p className="text-fg">
            <span className="tnum font-semibold">{active.year}</span>
            <span className="text-fg-muted"> closing </span>
            <span className={`tnum font-semibold ${active.isShortfall ? "text-danger" : ""}`}>
              {money(active.closingCents, { cents: false })}
            </span>
            {active.expenditures.length ? (
              <span className="text-fg-muted">
                {" "}
                · {active.expenditures.map((e) => e.name).join(", ")} at{" "}
                {shortMoney(active.expenditureCents)}
              </span>
            ) : null}
          </p>
        ) : (
          <p className="text-fg-muted">Hover a year for the detail.</p>
        )}
        <p className="flex items-center gap-3 text-[11px] text-fg-subtle">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-warn" />
            Replacement
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-danger" />
            Shortfall
          </span>
        </p>
      </div>
    </div>
  );
}
