 "use client";

import Link from "next/link";
import { useParams } from "next/navigation";
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

type VehicleDetailsResponse = Vehicle & {
  imageUrl: string;
};

async function fetchVehicle(id: string) {
  const res = await fetch(`/api/vehicles/${id}`);
  if (!res.ok) {
    throw new Error("Failed to fetch vehicle.");
  }
  return (await res.json()) as VehicleDetailsResponse;
}

export default function VehicleDetailsPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
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
    queryKey: ["vehicle", id],
    queryFn: () => fetchVehicle(id),
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
              <Link href="/vehicle-list">Back to list</Link>
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
          <Link href="/vehicle-list">Back to list</Link>
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
          />
        </CardContent>
      </Card>
    </div>
  );
}
