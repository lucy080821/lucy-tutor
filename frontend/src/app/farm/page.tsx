"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { getSessionUserId } from "@/lib/session";

// Game nặng về SVG/hoạt ảnh và chỉ có ý nghĩa khi đã đăng nhập → tách bundle, không prerender.
const FarmGame = dynamic(() => import("@/components/farm/FarmGame"), { ssr: false, loading: () => <div className="ui-card p-8 text-center text-muted">Đang mở cổng nông trại...</div> });

export default function FarmPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const uid = getSessionUserId();
    if (!uid) { router.push("/auth"); return; }
    setUserId(uid);
  }, [router]);

  return (
    <div className="min-h-screen bg-background">
      {/* Banner gọn: trang game phải thấy được cả cảnh + thanh điều hướng ngay trong 1 màn hình */}
      <div className="w-full bg-surface border-b border-line">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 text-sm text-muted">
              <Link href="/dashboard" className="font-semibold text-muted hover:text-primary transition-colors inline-flex items-center gap-1 py-1">← Quay lại Dashboard</Link>
              <span aria-hidden>·</span>
              <span>Trò chơi / Nông Trại Qilin</span>
            </div>
            <h1 className="ui-page-title text-xl sm:text-2xl leading-tight">Nông Trại Qilin</h1>
            <p className="ui-page-subtitle hidden md:block !mt-0 text-sm">Trồng từ vựng, thu hoạch bằng trí nhớ, giao hàng cho khách và trang trí nông trại của riêng bạn.</p>
          </div>
          <img src="/images/photos/game-hoc-tieng-anh-rong-qilin.webp" alt="Rồng Qilin" width={640} height={360} loading="eager" className="hidden md:block h-16 w-auto rounded-xl border border-line shadow-card shrink-0" />
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-4 py-3 pb-10">
        {userId ? <FarmGame userId={userId} /> : <div className="ui-card p-8 text-center text-muted">Đang kiểm tra đăng nhập...</div>}
      </div>
    </div>
  );
}
