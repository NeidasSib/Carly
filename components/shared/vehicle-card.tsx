"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { XIcon } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

type VehicleCardProps = {
  id: string;
  name: string;
  model: string;
  year: number;
  image: string;
  licensePlate: string;
  onDeleted?: () => void;
};

async function getResponseErrorMessage(res: Response) {
  try {
    const body = await res.json();
    if (typeof body?.error === "string" && body.error.trim()) {
      return body.error;
    }
    return `Request failed with status ${res.status}.`;
  } catch {
    return `Request failed with status ${res.status}.`;
  }
}

export default function VehicleCard({
  id,
  name,
  model,
  year,
  image,
  licensePlate,
  onDeleted,
}: VehicleCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleteError(null);
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/vehicles?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        setDeleteError(await getResponseErrorMessage(res));
        return false;
      }

      onDeleted?.();
      return true;
    } catch {
      setDeleteError("Network error while deleting vehicle.");
      return false;
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Card className="flex h-full flex-col overflow-hidden pt-0 max-h-105">
      <div className="relative w-full max-h-52 h-52 overflow-hidden">
        <Image
          src={image}
          alt={name}
          fill
          className="object-cover"
          unoptimized
        />
      </div>
      <CardHeader>
        <CardTitle className="text-xl font-semibold">{name}</CardTitle>
        <CardDescription>
          Model: {model}, Year: {year}
        </CardDescription>
        <CardAction></CardAction>
      </CardHeader>
      <CardContent className="">
        <p> {licensePlate} </p>
      </CardContent>
      <CardFooter className="justify-between">
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="icon" className="rounded-full">
              <XIcon />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete vehicle?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this vehicle and its photo.
              </AlertDialogDescription>
              {deleteError && (
                <p className="text-sm text-destructive" role="alert">
                  {deleteError}
                </p>
              )}
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={isDeleting}
                onClick={async (e) => {
                  e.preventDefault();
                  const success = await handleDelete();
                  if (success) {
                    setConfirmOpen(false);
                  }
                }}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Link href={`/vehicle-list/${id}`}>
          <Button variant="outline" className="rounded-full ">
            View Details
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
