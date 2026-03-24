"use client";
import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function Redirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get("user_id") || "";
  const forceScan = searchParams.get("scan") === "1";

  useEffect(() => {
    if (!userId) return;
    sessionStorage.setItem("jobscan_user_id", userId);

    // URL behavior:
    // - /jobs-search?user_id=...&scan=1 => force fresh scraping pipeline
    // - /jobs-search?user_id=...        => load dashboard from DB only
    if (forceScan) {
      router.replace(`/app?user_id=${userId}&scan=1`);
      return;
    }
    router.replace(`/app?user_id=${userId}`);
  }, [userId, forceScan, router]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      Loading…
    </div>
  );
}

export default function JobsSearchPage() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <Redirect />
    </Suspense>
  );
}