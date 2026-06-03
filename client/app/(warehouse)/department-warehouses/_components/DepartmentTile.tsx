"use client";

import Link from "next/link";
import type { DepartmentWarehouseSummary } from "@/lib/userService";
import { fmtCompact, type TileColor } from "../_types";

interface Props {
  summary: DepartmentWarehouseSummary;
  color: TileColor;
  index: number;
  isDark: boolean;
}

// Bo'lim omborini ifodalovchi rangli plitka. Bosilganda o'sha bo'lim omboriga o'tadi.
export function DepartmentTile({ summary: s, color, index: i, isDark }: Props) {
  const isEmpty = s.productCount === 0;

  const emptyBg = "linear-gradient(135deg, #eef0f3 0%, #dfe2e8 100%)";
  const cardShadow = isDark
    ? "shadow-[0_6px_18px_rgba(0,0,0,0.32)] hover:shadow-[0_18px_42px_rgba(0,0,0,0.45)]"
    : "shadow-[0_4px_14px_rgba(15,23,42,0.08)] hover:shadow-[0_14px_32px_rgba(15,23,42,0.16)]";
  const badgeClass = "inline-flex items-center justify-center font-mono text-[12px] font-semibold text-white bg-[#6b7280] px-3.5 h-[28px] min-w-[36px] rounded-full";
  const titleClass = "font-head-itm text-[17px] font-bold text-[#1f2430] leading-snug tracking-tight";

  return (
    <Link
      href={`/department-warehouses/${s.departmentId}`}
      className={`nd-fadein-${Math.min(i, 4)} group relative overflow-hidden
                  block rounded-[16px] aspect-[5/4.8]
                  ${cardShadow}
                  transition-all duration-300 ease-out cursor-pointer
                  hover:-translate-y-1`}
      style={{
        background: isEmpty
          ? emptyBg
          : `linear-gradient(135deg, ${color.soft} 0%, ${color.bg} 100%)`,
      }}
    >
      {/* Badge — top-right, has its own offset */}
      <span className={`${badgeClass} absolute top-[18px] right-[16px]`}>
        {isEmpty ? "0" : fmtCompact(s.totalQuantity)}
      </span>

      {/* Title — fixed 2-line area anchored to bottom; text starts at top so 1- and 2-line names align */}
      <h3
        className={`${titleClass} absolute bottom-[16px] left-[16px] right-[16px] h-[48px] flex items-start`}
        title={s.departmentName}
      >
        <span className="line-clamp-2 [word-break:break-word]">
          {s.departmentName}
        </span>
      </h3>
    </Link>
  );
}
