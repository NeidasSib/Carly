"use client";

import { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export type ViewId = "dashboard" | "vehicle-list" | "maintenance";

function getViewFromPathname(pathname: string): ViewId {
  if (pathname.startsWith("/vehicle-list")) return "vehicle-list";
  if (pathname.startsWith("/maintenance")) return "maintenance";
  return "dashboard";
}

function getPathFromView(viewId: ViewId): string {
  switch (viewId) {
    case "vehicle-list":
      return "/vehicle-list";
    case "maintenance":
      return "/maintenance";
    case "dashboard":
    default:
      return "/dashboard";
  }
}

export function ProtectedShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const currentView = getViewFromPathname(pathname);

  const handleNavigate = (viewId: ViewId) => {
    router.push(getPathFromView(viewId));
  };

  return (
    <SidebarProvider>
      <AppSidebar currentView={currentView} onNavigate={handleNavigate} />
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
