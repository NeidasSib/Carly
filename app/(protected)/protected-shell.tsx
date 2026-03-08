"use client";

import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export type ViewId =
  | "dashboard"
  | "vehicle-list"
  | "calendar"
  | "bookings"
  | "manage-company"
  | "profile";
type WorkspaceOption = {
  id: string;
  name: string;
  type: "personal" | "company";
  role?: string;
};

function getViewFromPathname(pathname: string): ViewId {
  if (pathname.startsWith("/profile")) return "profile";
  if (pathname.startsWith("/bookings")) return "bookings";
  if (pathname.startsWith("/company")) return "manage-company";
  if (pathname.startsWith("/vehicle-list")) return "vehicle-list";
  if (pathname.startsWith("/calendar")) return "calendar";
  return "dashboard";
}

function getPathFromView(viewId: ViewId): string {
  switch (viewId) {
    case "vehicle-list":
      return "/vehicle-list";
    case "calendar":
      return "/calendar";
    case "bookings":
      return "/bookings";
    case "manage-company":
      return "/company";
    case "profile":
      return "/profile";
    case "dashboard":
    default:
      return "/dashboard";
  }
}

export function ProtectedShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([
    { id: "personal", name: "Personal", type: "personal" },
  ]);

  const currentView = getViewFromPathname(pathname);
  const activeWorkspace = searchParams.get("ws") ?? "personal";

  const loadWorkspaces = useCallback(async () => {
    try {
      const res = await fetch("/api/workspaces");
      if (!res.ok) return;
      const payload = await res.json();
      if (Array.isArray(payload.data) && payload.data.length > 0) {
        setWorkspaces(payload.data);
      }
    } catch {}
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadWorkspaces();
    });
  }, [loadWorkspaces]);

  const navigationQuery = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (activeWorkspace === "personal") {
      params.delete("ws");
    } else {
      params.set("ws", activeWorkspace);
    }
    const query = params.toString();
    return query ? `?${query}` : "";
  }, [searchParams, activeWorkspace]);

  const handleNavigate = (viewId: ViewId) => {
    router.push(`${getPathFromView(viewId)}${navigationQuery}`);
  };

  const handleWorkspaceChange = (workspaceId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (workspaceId === "personal") {
      params.delete("ws");
    } else {
      params.set("ws", workspaceId);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <SidebarProvider>
      <AppSidebar
        currentView={currentView}
        onNavigate={handleNavigate}
        workspaces={workspaces}
        activeWorkspace={activeWorkspace}
        onWorkspaceChange={handleWorkspaceChange}
        onCompanyCreated={async (workspaceId) => {
          await loadWorkspaces();
          handleWorkspaceChange(workspaceId);
        }}
      />
      <SidebarInset>
        <header className="flex h-14 items-center border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <h1 className="ml-auto text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 antialiased">
            Carly
          </h1>
        </header>
        <main>{children}</main>
        <footer></footer>
      </SidebarInset>
    </SidebarProvider>
  );
}
