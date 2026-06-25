"use client";

import { useCallback, useEffect, useState } from "react";
import { contractService, type ContractResponse } from "@/lib/userService";
import { type ContractReadinessScope } from "../_types";

export const READINESS_PAGE_SIZE = 20;

// Shartnoma tayyorlik (readiness) ro'yxatini yuklab beruvchi umumiy hook —
// `/techprocess` va `/costnorm` sahifalari bir xil scope ma'lumotidan
// foydalanadi (har scope: chizma + TP + CN holati). Filtrlar, sahifalash va
// debounce qidiruvni o'zi boshqaradi.
export function useReadiness() {
  const [viewMode, setViewMode] = useState<"active" | "archive">("active");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<ContractReadinessScope[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [contractList, setContractList] = useState<ContractResponse[]>([]);

  const reload = useCallback(async (p = page) => {
    try {
      setLoading(true);
      const data = await contractService.getReadinessOverview(p, READINESS_PAGE_SIZE, {
        search: search || undefined,
        isActive: viewMode === "active",
      });
      setItems((data?.items ?? []) as ContractReadinessScope[]);
      setTotalPages(data?.totalPages ?? 1);
      setTotalCount(data?.totalCount ?? 0);
    } catch {
      setItems([]); setTotalPages(1); setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [viewMode, search, page]);

  const loadContracts = useCallback(async () => {
    try { setContractList(await contractService.getAll(undefined, undefined, viewMode === "active")); }
    catch { setContractList([]); }
  }, [viewMode]);

  // Filtr o'zgarsa 1-sahifaga qaytamiz.
  useEffect(() => { setPage(1); }, [viewMode, search]);

  // Sahifa yoki filtr o'zgarsa qayta yuklash (qidiruvni debounce qilamiz).
  useEffect(() => {
    const t = setTimeout(() => { reload(page); }, search ? 250 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, viewMode, search]);

  useEffect(() => { loadContracts(); }, [loadContracts]);

  return {
    viewMode, setViewMode, search, setSearch,
    items, loading, page, setPage, totalPages, totalCount,
    contractList, reload, loadContracts,
    PAGE_SIZE: READINESS_PAGE_SIZE,
  };
}
