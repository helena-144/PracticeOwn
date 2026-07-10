"use client";

import { useRouter } from "next/navigation";
import { Bell, CreditCard, LogOut, Settings, User as UserIcon } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MobileSidebar } from "@/components/dashboard/sidebar";
import { useAlerts } from "@/hooks/useAlerts";
import { signOutAction } from "@/lib/actions/auth";
import { cn, getInitials } from "@/lib/utils";
import type { Clinician } from "@/types/practice";

const SEVERITY_DOT: Record<string, string> = {
  low: "bg-blue-500",
  medium: "bg-warning",
  high: "bg-warning",
  critical: "bg-destructive",
};

export function DashboardHeader({
  clinician,
  practiceName,
  practiceId,
}: {
  clinician: Clinician | null;
  practiceName: string | null;
  practiceId: string | null;
}) {
  const router = useRouter();
  const { alerts, unreadCount, markAsRead } = useAlerts(practiceId);

  const fullName = clinician ? `${clinician.first_name} ${clinician.last_name}`.trim() : null;

  async function handleSignOut() {
    await signOutAction();
  }

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-4 md:px-6">
      <div className="flex items-center gap-3">
        <MobileSidebar />
        <div className="text-sm font-medium text-muted-foreground">
          {practiceName ?? "Your practice"}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="border-b px-4 py-3 text-sm font-semibold">Alerts</div>
            <div className="max-h-80 overflow-y-auto">
              {alerts.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  You&apos;re all caught up.
                </p>
              )}
              {alerts.map((alert) => (
                <button
                  key={alert.id}
                  onClick={() => !alert.is_read && markAsRead(alert.id)}
                  className={cn(
                    "flex w-full gap-3 border-b px-4 py-3 text-left text-sm last:border-0 hover:bg-accent",
                    !alert.is_read && "bg-accent/50"
                  )}
                >
                  <span
                    className={cn(
                      "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                      SEVERITY_DOT[alert.severity] ?? "bg-muted-foreground"
                    )}
                  />
                  <span className="flex-1">
                    <span className="block font-medium">{alert.title}</span>
                    {alert.description && (
                      <span className="block text-xs text-muted-foreground">
                        {alert.description}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 px-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-xs">
                  {fullName ? getInitials(fullName) : <UserIcon className="h-3.5 w-3.5" />}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium sm:inline-block">
                {fullName ?? clinician?.email}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="font-medium">{fullName ?? "Account"}</span>
                <span className="font-normal text-xs text-muted-foreground">
                  {clinician?.email}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/settings")}>
              <Settings className="h-4 w-4" />
              Profile &amp; Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/billing")}>
              <CreditCard className="h-4 w-4" />
              Billing
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
