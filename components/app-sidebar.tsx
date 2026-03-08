import * as React from "react";
import type { ViewId } from "@/app/(protected)/protected-shell";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { LogoutButton } from "@/components/logout-button";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, ChevronsUpDown } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AppSidebar({
  currentView,
  onNavigate,
  workspaces,
  activeWorkspace,
  onWorkspaceChange,
  onCompanyCreated,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  currentView: ViewId;
  onNavigate: (viewId: ViewId) => void;
  workspaces: {
    id: string;
    name: string;
    type: "personal" | "company";
    role?: string;
  }[];
  activeWorkspace: string;
  onWorkspaceChange: (workspaceId: string) => void;
  onCompanyCreated?: (workspaceId: string) => void | Promise<void>;
}) {
  const [createCompanyOpen, setCreateCompanyOpen] = React.useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = React.useState(false);
  const [companyName, setCompanyName] = React.useState("");
  const [isCreating, setIsCreating] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [profileDisplayName, setProfileDisplayName] = React.useState("Profile");
  const [profileAvatarUrl, setProfileAvatarUrl] = React.useState<string | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const activeWorkspaceLabel =
    workspaces.find((workspace) => workspace.id === activeWorkspace)?.name ??
    "Personal";
  const isCompanyWorkspace = activeWorkspace.startsWith("company:");
  const navItems: { title: string; viewId: ViewId }[] = [
    { title: "Dashboard", viewId: "dashboard" },
    { title: "Vehicle List", viewId: "vehicle-list" },
    { title: "Calendar", viewId: "calendar" },
    ...(isCompanyWorkspace
      ? [
          { title: "Bookings", viewId: "bookings" as const },
          { title: "Manage Company", viewId: "manage-company" as const },
        ]
      : []),
  ];

  React.useEffect(() => {
    let ignore = false;
    async function loadProfile() {
      try {
        const res = await fetch("/api/profile");
        if (!res.ok) return;
        const body = (await res.json()) as {
          data: {
            display_name?: string | null;
            avatar_signed_url?: string | null;
          } | null;
        };
        if (ignore || !body.data) return;
        setProfileDisplayName(body.data.display_name?.trim() || "Profile");
        setProfileAvatarUrl(body.data.avatar_signed_url ?? null);
      } catch {}
    }
    void loadProfile();
    return () => {
      ignore = true;
    };
  }, []);

  async function handleCreateCompany(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setIsCreating(true);
    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: companyName }),
      });
      if (!res.ok) {
        let errorMessage = "Failed to create company.";
        try {
          const body = await res.json();
          if (typeof body?.error === "string" && body.error.trim()) {
            errorMessage = body.error;
          }
        } catch {}
        setCreateError(errorMessage);
        return;
      }

      const company = await res.json();
      const workspaceId = `company:${company.id}`;
      setCompanyName("");
      setCreateCompanyOpen(false);
      await onCompanyCreated?.(workspaceId);
    } catch {
      setCreateError("Failed to create company.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2 py-2">
          <div className="pl-1">
            <Avatar className="size-10">
              <AvatarImage src={profileAvatarUrl ?? undefined} />
              <AvatarFallback>
                {profileDisplayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
          <div>
            <button
              type="button"
              className="text-left text-lg font-semibold hover:underline"
              onClick={() => onNavigate("profile")}
            >
              {profileDisplayName}
            </button>
          </div>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu open={workspaceMenuOpen} onOpenChange={setWorkspaceMenuOpen}>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="justify-between">
                  <span className="truncate">{activeWorkspaceLabel}</span>
                  <motion.div
                    animate={{ rotate: workspaceMenuOpen ? 180 : 0 }}
                    transition={
                      prefersReducedMotion
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 360, damping: 24 }
                    }
                  >
                    <ChevronsUpDown className="size-4 opacity-60" />
                  </motion.div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-(--radix-dropdown-menu-trigger-width)"
                align="start"
              >
                {workspaces.map((workspace) => (
                  <DropdownMenuItem
                    key={workspace.id}
                    onSelect={() => onWorkspaceChange(workspace.id)}
                  >
                    {workspace.name}
                    {workspace.id === activeWorkspace && (
                      <Check className="ml-auto size-4" />
                    )}
                  </DropdownMenuItem>
                ))}
                {activeWorkspace === "personal" && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setCreateCompanyOpen(true)}>
                      Add company
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Getting Started</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.viewId}>
                  <SidebarMenuButton asChild isActive={currentView === item.viewId}>
                    <motion.button
                      type="button"
                      onClick={() => onNavigate(item.viewId)}
                      whileHover={prefersReducedMotion ? undefined : { x: 4 }}
                      transition={
                        prefersReducedMotion
                          ? { duration: 0 }
                          : { type: "spring", stiffness: 420, damping: 26 }
                      }
                      className="relative"
                    >
                      {currentView === item.viewId ? (
                        <motion.span
                          layoutId="sidebar-active-pill"
                          className="absolute inset-0 rounded-md bg-sidebar-accent"
                          transition={
                            prefersReducedMotion
                              ? { duration: 0 }
                              : { type: "spring", stiffness: 500, damping: 36 }
                          }
                        />
                      ) : null}
                      <span className="relative z-10">{item.title}</span>
                    </motion.button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <div className="border-t p-3 flex justify-center">
        <LogoutButton />
      </div>

      <SidebarRail />

      <Dialog open={createCompanyOpen} onOpenChange={setCreateCompanyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create company</DialogTitle>
            <DialogDescription>
              Add a company workspace for shared fleet management.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateCompany} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="company-name">Company name</Label>
              <Input
                id="company-name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Company name"
                required
              />
            </div>
            {createError ? (
              <p className="text-sm text-destructive">{createError}</p>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateCompanyOpen(false)}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? "Creating..." : "Create company"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}
