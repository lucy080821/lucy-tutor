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
      <body suppressHydrationWarning className="antialiased min-h-screen flex flex-col bg-slate-100">

        {/* Global Header */}
        <header className="sticky top-0 z-50 bg-white shadow-sm">
          {/* Blue accent bar */}
          <div className="h-1 bg-gradient-to-r from-blue-800 via-blue-600 to-indigo-500" />
          <div className="px-4 md:px-8 py-3 flex justify-between md:justify-center items-center gap-4 md:gap-10 lg:gap-32">
            <Link href="/" className="flex items-center gap-2 md:gap-3 group">
              <img
                src="/logo.png"
                alt="Lucy Tutor Logo"
                className="w-9 h-9 md:w-12 md:h-12 object-contain group-hover:scale-105 transition-transform duration-300"
              />
              <div className="flex flex-col leading-none">
                <span className="text-xl md:text-2xl font-black text-primary tracking-tight">
                  LUCY<span className="text-slate-400">TUTOR</span>
                </span>
                <span className="hidden md:block text-[10px] text-slate-400 font-medium tracking-widest uppercase">
                  English Learning Platform
                </span>
              </div>
            </Link>

            <div className="hidden lg:flex items-center">
              <p className="text-sm italic text-slate-500 font-medium border-l-2 border-primary/40 pl-4 py-0.5">
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
