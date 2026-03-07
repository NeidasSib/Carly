"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Vehicle } from "@/app/generated/prisma/browser";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import VehicleDetailsForm from "@/components/shared/vehicle-details-form";
import VehicleAssignmentsPanel from "@/components/shared/vehicle-assignments-panel";

type VehicleDetailsResponse = Vehicle & {
  imageUrl: string;
};

function toDateInputValue(value: string | Date | null | undefined) {
  if (!value) return "";
  if (typeof value === "string") {
    const [datePart] = value.split("T");
    if (datePart && /^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      return datePart;
    }
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function fetchVehicle(id: string, workspace: string) {
  const params = new URLSearchParams({ ws: workspace });
  const res = await fetch(`/api/vehicles/${id}?${params.toString()}`);
  if (!res.ok) {
    throw new Error("Failed to fetch vehicle.");
  }
  return (await res.json()) as VehicleDetailsResponse;
}

export default function VehicleDetailsPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params.id;
  const workspace = searchParams.get("ws") ?? "personal";
  const queryClient = useQueryClient();

  const cachedLists = queryClient.getQueriesData<{ data: Vehicle[] }>({
    queryKey: ["vehicles"],
  });

  const cachedVehicle =
    cachedLists
      .map(([, value]) => value?.data ?? [])
      .flat()
      .find((vehicle) => vehicle.id === id) ?? null;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["vehicle", id, workspace],
    queryFn: () => fetchVehicle(id, workspace),
    enabled: Boolean(id),
    initialData: cachedVehicle
      ? ({
          ...cachedVehicle,
          imageUrl: cachedVehicle.image,
        } as VehicleDetailsResponse)
      : undefined,
  });

  if (!id) {
    return null;
  }

  if (isLoading && !data) {
    return (
      <div className="p-4">
        <p className="text-sm text-muted-foreground">Loading vehicle details...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-4">
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Vehicle not found</CardTitle>
            <CardDescription>
              This vehicle may not exist or you may not have access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link
                href={
                  workspace === "personal"
                    ? "/vehicle-list"
                    : `/vehicle-list?ws=${encodeURIComponent(workspace)}`
                }
              >
                Back to list
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Vehicle details</h2>
        <Button asChild variant="outline" size="sm">
          <Link
            href={
              workspace === "personal"
                ? "/vehicle-list"
                : `/vehicle-list?ws=${encodeURIComponent(workspace)}`
            }
          >
            Back to list
          </Link>
        </Button>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Edit vehicle</CardTitle>
          <CardDescription>
            Update details and upload a new photo if needed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VehicleDetailsForm
            id={data.id}
            name={data.name}
            model={data.model}
            year={data.year}
            licensePlate={data.license_plate}
            imageUrl={data.imageUrl}
            vin={data.vin}
            fuelType={data.fuel_type}
            transmission={data.transmission}
            insuranceValidUntil={toDateInputValue(data.insurance_valid_until)}
            inspectionValidUntil={toDateInputValue(data.inspection_valid_until)}
            roadTaxValidUntil={toDateInputValue(data.road_tax_valid_until)}
            workspace={workspace}
          />
        </CardContent>
      </Card>

      <Card className="mt-4 max-w-2xl">
        <CardHeader>
          <CardTitle>Assignments</CardTitle>
          <CardDescription>
            Assign this vehicle for specific time ranges.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VehicleAssignmentsPanel vehicleId={data.id} workspace={workspace} />
        </CardContent>
      </Card>
    </div>
  );
}
