"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CostNormRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/techprocess");
  }, [router]);
  return null;
}
