"use client";
import { Vehicle } from "@/app/generated/prisma/browser";
import VehicleCard from "@/components/shared/vehicle-card";
import { useEffect } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { PlusIcon, Search, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMemo, useState } from "react";
import AddVehicleModal from "@/components/shared/add-vehicle-modal";

export default function VehicleListView() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const limit = 10;
  const [pagination, setPagination] = useState<{
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    total: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setLoading(true);
    });
    fetch(`/api/vehicles?page=${page}&limit=${limit}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then((json) => {
        if (!cancelled) {
          setVehicles(json.data);
          setPagination(json.pagination);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page]);

  const [query, setQuery] = useState("");

  const filteredVehicles = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return vehicles;

    return vehicles.filter((v) => {
      return (
        v.name.toLowerCase().includes(q) ||
        v.model.toLowerCase().includes(q) ||
        v.license_plate.toLowerCase().includes(q) ||
        String(v.year).includes(q)
      );
    });
  }, [vehicles, query]);

  const [addModalOpen, setAddModalOpen] = useState(false);

  return (
    <>
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div
          className="grid items-center pb-5 gap-4"
          style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}
        >
          <div className="w-full">
            <InputGroup>
              <InputGroupInput
                placeholder="Search..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
            </InputGroup>
          </div>

          <Button
            variant="outline"
            size="icon"
            className="rounded-full"
            onClick={() => setAddModalOpen(true)}
          >
            <PlusIcon />
          </Button>
        </div>
        <div className="grid gap-6 gap-6 grid-cols-[repeat(auto-fill,minmax(18rem,1fr))]">
          {filteredVehicles.map((vehicle) => (
            <VehicleCard
              key={vehicle.id}
              name={vehicle.name}
              model={vehicle.model}
              year={vehicle.year}
              image={vehicle.image}
              licensePlate={vehicle.license_plate}
            />
          ))}
        </div>
      </div>

      {addModalOpen && (
        <AddVehicleModal onClose={() => setAddModalOpen(false)} />
      )}
    </>
  );
}
