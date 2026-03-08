"use client";
import { Vehicle } from "@/app/generated/prisma/browser";
import VehicleCard from "@/components/shared/vehicle-card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { PlusIcon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import AddVehicleModal from "@/components/shared/add-vehicle-modal";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

const MAX_VEHICLES_PER_WORKSPACE = 20;

type VehiclesResponse = {
  data: Vehicle[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  totalInWorkspace?: number;
};

async function fetchVehicles(
  page: number,
  limit: number,
  query: string,
  workspace: string
) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    q: query,
    ws: workspace,
  });
  const res = await fetch(`/api/vehicles?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch vehicles");
  return (await res.json()) as VehiclesResponse;
}

export default function VehicleListView() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const workspace = searchParams.get("ws") ?? "personal";
  const [page, setPage] = useState(1);
  const limit = 10;
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 350);

    return () => clearTimeout(timeoutId);
  }, [query]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["vehicles", page, limit, debouncedQuery, workspace],
    queryFn: () => fetchVehicles(page, limit, debouncedQuery, workspace),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const vehicles = data?.data ?? [];
  const pagination = data?.pagination ?? null;
  const totalInWorkspace = data?.totalInWorkspace ?? 0;
  const atVehicleLimit = totalInWorkspace >= MAX_VEHICLES_PER_WORKSPACE;

  const [addModalOpen, setAddModalOpen] = useState(false);

  return (
    <>
      <div className="flex h-[calc(100dvh-3.5rem)] flex-col p-4">
        <div
          className="grid items-center pb-5 gap-4"
          style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}
        >
          <div className="w-full">
            <InputGroup>
              <InputGroupInput
                placeholder="Search..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
              />
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
            </InputGroup>
          </div>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-full"
                    onClick={() => setAddModalOpen(true)}
                    disabled={atVehicleLimit}
                  >
                    <PlusIcon />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {atVehicleLimit
                  ? `Vehicle limit reached (${MAX_VEHICLES_PER_WORKSPACE} per workspace).`
                  : "Add vehicle"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid gap-6 gap-6 grid-cols-[repeat(auto-fill,minmax(18rem,1fr))]">
            {vehicles.map((vehicle) => (
              <VehicleCard
                key={vehicle.id}
                id={vehicle.id}
                name={vehicle.name}
                model={vehicle.model}
                year={vehicle.year}
                image={vehicle.image}
                licensePlate={vehicle.license_plate}
                workspace={workspace}
                onDeleted={() =>
                  queryClient.invalidateQueries({ queryKey: ["vehicles"] })
                }
              />
            ))}
          </div>
          {isLoading && (
            <p className="pt-4 text-sm text-muted-foreground">
              Loading vehicles...
            </p>
          )}
          {!isLoading && vehicles.length === 0 && (
            <p className="pt-4 text-sm text-muted-foreground">
              No vehicles found.
            </p>
          )}
        </div>
        <div className="mt-4 border-t pt-3">
          {pagination ? (
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={!pagination.hasPreviousPage || isFetching}
              >
                Previous
              </Button>
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages}
                {isFetching ? " (refreshing...)" : ""}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={!pagination.hasNextPage || isFetching}
              >
                Next
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No pages available.</p>
          )}
        </div>
      </div>

      {addModalOpen && (
        <AddVehicleModal
          workspace={workspace}
          onClose={() => setAddModalOpen(false)}
          onSuccess={() =>
            queryClient.invalidateQueries({ queryKey: ["vehicles"] })
          }
        />
      )}
    </>
  );
}
