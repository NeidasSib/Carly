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

const data: {
  navMain: {
    title: string;
    items: {
      title: string;
      viewId: ViewId;
    }[];
  }[];
} = {
  navMain: [
    {
      title: "Getting Started",
      items: [
        {
          title: "Dashboard",
          viewId: "dashboard",
        },
        {
          title: "Vehicle List",
          viewId: "vehicle-list",
        },
        {
          title: "Maintenance",
          viewId: "maintenance",
        },
      ],
    },
  ],
};

export function AppSidebar({
  currentView,
  onNavigate,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  currentView: ViewId;
  onNavigate: (viewId: ViewId) => void;
}) {
  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2 py-2">
          <div className="pl-1">
            <Avatar className="size-10">
              <AvatarImage src="https://github.com/shadcn.png" />
              <AvatarFallback>CN</AvatarFallback>
            </Avatar>
          </div>
          <div>
            <h1 className="text-lg font-semibold">View Profile</h1>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {data.navMain.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.viewId}>
                    <SidebarMenuButton
                      isActive={currentView === item.viewId}
                      onClick={() => onNavigate(item.viewId)}
                    >
                      {item.title}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <div className="border-t p-3 flex justify-center">
        <LogoutButton />
      </div>

      <SidebarRail />
    </Sidebar>
  );
}
