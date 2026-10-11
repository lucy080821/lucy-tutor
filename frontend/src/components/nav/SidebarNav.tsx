"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import NavIcon, { type NavIconName } from "./NavIcon";

// Sidebar dùng chung cho dashboard giáo viên và học viên: các nhóm mục theo công việc (nhãn nhóm nhỏ, không
// đường kẻ ngăn giữa từng nhóm), icon nét mảnh, badge số việc cần xử lý, nhóm thu gọn được (nhớ trạng thái
// qua localStorage) và thẻ người dùng cố định ở đáy. Trang cha chỉ khai báo dữ liệu, không tự vẽ menu.

export type NavItem = {
  id: string;
  label: string;
  icon: NavIconName;
  active?: boolean;
  badge?: number;
  /** Có href → Link sang trang khác; không có → onClick (đổi tab trong trang) */
  href?: string;
  onClick?: () => void;
};

export type NavSection = { id: string; label?: string; items: NavItem[] };

function Badge({ n }: { n?: number }) {
  if (!n) return null;
  return <span className="ml-auto min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold leading-5 text-center">{n > 99 ? "99+" : n}</span>;
}

function Item({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const cls = `group/nav flex items-center gap-3 w-full rounded-[10px] px-3 py-2 text-[14px] font-semibold transition-colors ${
    item.active
      ? "bg-primary-soft text-primary shadow-[inset_3px_0_0_var(--primary)]"
      : "text-foreground/70 hover:bg-[#f3f6fb] hover:text-primary"
  }`;
  const inner = (
    <>
      <NavIcon name={item.icon} className={`w-[18px] h-[18px] ${item.active ? "text-primary" : "text-[#8a97ab] group-hover/nav:text-primary"}`} />
      <span className="truncate">{item.label}</span>
      <Badge n={item.badge} />
    </>
  );
  if (item.href) {
    return <Link href={item.href} onClick={onNavigate} className={cls} aria-current={item.active ? "page" : undefined}>{inner}</Link>;
  }
  return (
    <button type="button" onClick={() => { item.onClick?.(); onNavigate?.(); }} className={`${cls} cursor-pointer text-left`} aria-current={item.active ? "page" : undefined}>
      {inner}
    </button>
  );
}

export default function SidebarNav({ sections, header, footer, collapsible = false, storageKey, onNavigate }: {
  sections: NavSection[];
  header?: React.ReactNode;
  footer?: React.ReactNode;
  /** Cho phép thu gọn từng nhóm có nhãn (dùng khi menu dài) */
  collapsible?: boolean;
  /** Khoá localStorage nhớ các nhóm đang thu gọn */
  storageKey?: string;
  /** Gọi sau mỗi lần chọn mục (vd đóng menu trên mobile) */
  onNavigate?: () => void;
}) {
  // Sidebar chỉ render sau khi dashboard tải xong dữ liệu người dùng ở trình duyệt (server chỉ trả skeleton),
  // nên đọc localStorage ngay lúc khởi tạo không gây lệch hydration.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    if (!collapsible || !storageKey || typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem(storageKey) || "{}"); } catch { return {}; }
  });

  const toggle = (id: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      if (storageKey) { try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* storage bị chặn */ } }
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full">
      {header && <div className="px-3 pb-3">{header}</div>}

      <nav aria-label="Menu chính" className="flex-1 overflow-y-auto px-3 pb-4">
        {sections.filter((s) => s.items.length > 0).map((section, i) => {
          // Nhóm đang chứa mục active luôn mở để người dùng không bị "mất" vị trí
          const hasActive = section.items.some((it) => it.active);
          const isCollapsed = collapsible && !!section.label && !!collapsed[section.id] && !hasActive;
          return (
            <div key={section.id} className={i > 0 ? "mt-5" : ""}>
              {section.label && (
                collapsible ? (
                  <button type="button" onClick={() => toggle(section.id)} aria-expanded={!isCollapsed}
                    className="ui-nav-group-label w-full flex items-center justify-between mb-1.5 py-1 cursor-pointer hover:text-primary transition-colors">
                    <span>{section.label}</span>
                    <NavIcon name="chevron" className={`w-3.5 h-3.5 transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
                  </button>
                ) : (
                  <p className="ui-nav-group-label mb-1.5 py-1">{section.label}</p>
                )
              )}
              {!isCollapsed && (
                <ul className="flex flex-col gap-0.5">
                  {section.items.map((item) => <li key={item.id}><Item item={item} onNavigate={onNavigate} /></li>)}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      {footer && <div className="border-t border-line p-3">{footer}</div>}
    </div>
  );
}

/** Thẻ tài khoản ở đáy sidebar: avatar (bấm để đổi ảnh), tên, vai trò, nút Cài đặt (tuỳ chọn) và Đăng xuất. */
export function SidebarUserCard({ name, role, avatar, onAvatarChange, onSettings, settingsActive, onLogout }: {
  name: string;
  role: string;
  avatar?: string | null;
  onAvatarChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSettings?: () => void;
  settingsActive?: boolean;
  onLogout: () => void;
}) {
  const iconBtn = "w-9 h-9 shrink-0 flex items-center justify-center rounded-full transition-colors cursor-pointer";
  return (
    <div className="flex items-center gap-3 rounded-2xl p-2 hover:bg-[#f3f6fb] transition-colors">
      <label className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold shrink-0 cursor-pointer relative overflow-hidden group/av" title="Đổi ảnh đại diện">
        <input type="file" accept="image/*" className="hidden" onChange={onAvatarChange} />
        {avatar ? <img src={avatar} alt="Ảnh đại diện" className="w-full h-full object-cover" /> : (name.charAt(0).toUpperCase() || "?")}
        <span className="absolute inset-0 bg-primary/70 flex items-center justify-center opacity-0 group-hover/av:opacity-100 transition-opacity text-[9px] font-bold tracking-wider">ĐỔI</span>
      </label>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-foreground truncate">{name}</p>
        <p className="text-[11px] text-muted font-semibold uppercase tracking-wider">{role}</p>
      </div>
      {onSettings && (
        <button type="button" onClick={onSettings} aria-label="Cài đặt tài khoản" title="Cài đặt tài khoản"
          className={`${iconBtn} ${settingsActive ? "bg-primary-soft text-primary" : "text-[#8a97ab] hover:bg-primary-soft hover:text-primary"}`}>
          <NavIcon name="settings" />
        </button>
      )}
      <button type="button" onClick={onLogout} aria-label="Đăng xuất" title="Đăng xuất"
        className={`${iconBtn} text-[#8a97ab] hover:bg-red-50 hover:text-red-600`}>
        <NavIcon name="logout" />
      </button>
    </div>
  );
}

/** Nút "Tạo mới" đầu sidebar (kiểu "+ New" của Gmail/Notion): gom các hành động tạo nội dung vào 1 chỗ
 *  thay vì để chúng lẫn trong danh sách điều hướng. Đóng khi chọn, bấm ra ngoài hoặc nhấn Esc. */
export function SidebarCreateMenu({ actions, onNavigate }: {
  actions: { id: string; label: string; icon: NavIconName; href?: string; onClick?: () => void }[];
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("click", close);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("click", close); window.removeEventListener("keydown", onKey); };
  }, [open]);

  const done = () => { setOpen(false); onNavigate?.(); };
  const itemCls = "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-semibold text-foreground/80 hover:bg-primary-soft hover:text-primary transition-colors text-left cursor-pointer";
  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}
        className="btn-primary w-full px-4 py-2.5 text-sm flex items-center justify-center gap-2">
        <NavIcon name="plus" className="w-4 h-4" />
        Tạo mới
      </button>
      {open && (
        <div role="menu" className="absolute left-0 right-0 top-full mt-2 z-20 bg-white rounded-2xl border border-line shadow-card p-1.5">
          {actions.map((a) => a.href ? (
            <Link key={a.id} role="menuitem" href={a.href} onClick={done} className={itemCls}>
              <NavIcon name={a.icon} className="w-[18px] h-[18px] text-[#8a97ab]" />{a.label}
            </Link>
          ) : (
            <button key={a.id} role="menuitem" type="button" onClick={() => { a.onClick?.(); done(); }} className={itemCls}>
              <NavIcon name={a.icon} className="w-[18px] h-[18px] text-[#8a97ab]" />{a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
