import type { Metadata, Viewport } from "next";
import "./globals.css";
import Link from "next/link";
import PWARegister from "@/components/PWARegister";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION, baseOpenGraph } from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Lucy Tutor | Luyện thi Tiếng Anh THPT Quốc Gia & IELTS",
    template: "%s | Lucy Tutor",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "luyện thi tiếng Anh THPT Quốc Gia",
    "đề thi thử tiếng Anh THPT",
    "luyện thi IELTS",
    "IELTS Cambridge",
    "luyện nghe tiếng Anh",
    "luyện nói tiếng Anh với AI",
    "luyện đọc hiểu tiếng Anh",
    "luyện viết tiếng Anh",
    "luyện phát âm tiếng Anh",
    "học từ vựng SRS",
    "flashcard từ vựng",
    "ngữ pháp tiếng Anh",
    "bảng phiên âm IPA",
    "quản lý lớp học tiếng Anh",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    ...baseOpenGraph,
    url: "/",
    title: "Lucy Tutor | Luyện thi Tiếng Anh THPT Quốc Gia & IELTS",
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Lucy Tutor | Luyện thi Tiếng Anh THPT Quốc Gia & IELTS",
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  // Khai báo icon tường minh: chỉ để `apple` ở đây thì Next bỏ mất <link rel="icon"> tự sinh từ
  // app/icon.png (trình duyệt không thấy favicon, cả dev lẫn production). /favicon.ico vẫn được
  // Next tự khai báo từ file app/favicon.ico.
  icons: {
    icon: "/icon.png",
    apple: "/logo.png",
  },
  formatDetection: { telephone: false },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Lucy Tutor",
  },
};

export const viewport: Viewport = {
  themeColor: "#1E3A8A",
  // App chỉ có giao diện sáng — chặn Chrome/Edge "Auto Dark Mode" tự đảo màu làm vỡ giao diện
  colorScheme: "only light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body suppressHydrationWarning className="antialiased min-h-screen flex flex-col bg-background">
        <PWARegister />

        {/* Global Header — phong cách ieltsonlinetests: trắng, mảnh, viền dưới nhạt */}
        <header className="sticky top-0 z-50 bg-white border-b border-line shadow-[0_2px_12px_rgba(30,58,138,0.05)]">
          <div className="max-w-screen-2xl mx-auto px-4 md:px-8 h-14 md:h-16 flex justify-between items-center gap-2 sm:gap-4">
            <Link href="/" className="flex items-center gap-2 md:gap-3 group">
              <img
                src="/logo.png"
                alt="Lucy Tutor Logo"
                className="w-9 h-9 md:w-11 md:h-11 object-contain group-hover:scale-105 transition-transform duration-300"
              />
              <div className="flex flex-col leading-none">
                <span className="text-lg sm:text-xl md:text-2xl font-black text-primary tracking-tight">
                  LUCY<span className="text-slate-400">TUTOR</span>
                </span>
                <span className="hidden md:block text-[10px] text-muted font-semibold tracking-widest uppercase mt-0.5">
                  English Learning Platform
                </span>
              </div>
            </Link>

            <div className="flex items-center gap-2 md:gap-6">
              <nav aria-label="Menu chính" className="flex items-center md:gap-2">
                <Link href="/" className="text-[13px] sm:text-sm font-bold text-foreground hover:text-primary transition-colors px-1 sm:px-2 py-2">Trang chủ</Link>
                <Link href="/blog" className="text-[13px] sm:text-sm font-bold text-foreground hover:text-primary transition-colors px-1 sm:px-2 py-2">Blog</Link>
                {/* Khối liên hệ nằm cuối trang chủ (section#lien-he) */}
                <Link href="/#lien-he" className="text-[13px] sm:text-sm font-bold text-foreground hover:text-primary transition-colors px-1 sm:px-2 py-2">Liên hệ</Link>
              </nav>
              <p className="hidden lg:block text-sm text-muted font-semibold border-l-[3px] border-primary pl-3 py-0.5">
                "Học tập không ngừng, vươn tới thành công"
              </p>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col">
          {children}
        </main>

      </body>
    </html>
  );
}
