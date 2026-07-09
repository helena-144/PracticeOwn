"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BadgeCheck,
  Scale,
  Gauge,
  DoorOpen,
  FileQuestion,
  Settings,
  CreditCard,
  ShieldCheck,
} from "lucide-react";

import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/credentials", label: "Credentials", icon: BadgeCheck },
  { href: "/ownership-audit", label: "Ownership Audit", icon: Scale },
  { href: "/independence-score", label: "Independence Score", icon: Gauge },
  { href: "/exit-planner", label: "Exit Planner", icon: DoorOpen },
  { href: "/documentation-qa", label: "Documentation Q&A", icon: FileQuestion },
] as const;

const BOTTOM_NAV_ITEMS = [
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 border-r bg-background md:flex md:flex-col">
      <div className="flex h-14 items-center gap-2 border-b px-6">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <span className="font-semibold">PracticeOwn</span>
      </div>
      <nav className="flex flex-1 flex-col justify-between overflow-y-auto p-3">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} {...item} active={isActive(pathname, item.href)} />
          ))}
        </ul>
        <ul className="space-y-1 border-t pt-3">
          {BOTTOM_NAV_ITEMS.map((item) => (
            <NavLink key={item.href} {...item} active={isActive(pathname, item.href)} />
          ))}
        </ul>
      </nav>
    </aside>
  );
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {label}
      </Link>
    </li>
  );
}
