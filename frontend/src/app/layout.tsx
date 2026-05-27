import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Lucy Tutor | Luyện thi Tiếng Anh",
  description: "Nền tảng EdTech luyện thi Đại học môn Tiếng Anh hiệu suất cao.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className={`antialiased min-h-screen flex flex-col`}>
        
        {/* Global Header */}
        <header className="sticky top-0 z-50 bg-surface/90 backdrop-blur-sm border-b border-foreground/10 px-6 py-4 flex justify-center items-center gap-10 md:gap-32">
          <Link href="/" className="flex items-center gap-4 group">
            <img src="/logo.png" alt="Lucy Tutor Logo" className="w-14 h-14 object-contain rounded-2xl shadow-sm group-hover:scale-105 transition-transform duration-300" />
            <span className="text-3xl font-black text-primary tracking-tight">
              LUCY<span className="text-foreground">TUTOR</span>
            </span>
          </Link>

          <div className="hidden sm:flex items-center">
            <p className="text-sm md:text-base italic text-foreground/70 font-medium border-l-[3px] border-primary/60 pl-4 py-1">
              "Học tập không ngừng, vươn tới thành công"
            </p>
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
