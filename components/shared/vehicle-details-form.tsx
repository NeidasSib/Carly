"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

type VehicleDetailsFormProps = {
  id: string;
  name: string;
  model: string;
  year: number;
  licensePlate: string;
  imageUrl: string;
};

function getFileExtension(file: File) {
  const fromName = file.name.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase();
  if (fromName) return fromName;

  const mimeToExt: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/heic": "heic",
    "image/heif": "heif",
  };

  return mimeToExt[file.type] ?? "jpg";
}

function createObjectId() {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

async function uploadVehiclePhoto(file: File, userId: string): Promise<string> {
  const supabase = createClient();
  const ext = getFileExtension(file);
  const path = `private/${userId}/${createObjectId()}.${ext}`;

  const { error } = await supabase.storage
    .from("vehicle-photos")
    .upload(path, file, {
      upsert: false,
      contentType: file.type || undefined,
      cacheControl: "3600",
    });

  if (error) throw new Error(error.message);
  return path;
}

async function getResponseErrorMessage(res: Response) {
  try {
    const data = await res.json();
    if (typeof data?.error === "string" && data.error.trim()) {
      return data.error;
    }
    return `Request failed with status ${res.status}.`;
  } catch {
    return `Request failed with status ${res.status}.`;
  }
}

export default function VehicleDetailsForm({
  id,
  name,
  model,
  year,
  licensePlate,
  imageUrl,
}: VehicleDetailsFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name,
    model,
    year: String(year),
    license_plate: licensePlate,
  });
  const [previewImage, setPreviewImage] = useState(imageUrl);
  const [file, setFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSaving(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("You must be signed in.");
        return;
      }

      let imagePath: string | undefined;
      if (file) {
        imagePath = await uploadVehiclePhoto(file, user.id);
      }

      const res = await fetch(`/api/vehicles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          year: Number(form.year),
          ...(imagePath ? { image: imagePath } : {}),
        }),
      });

      if (!res.ok) {
        setError(await getResponseErrorMessage(res));
        return;
      }

      const updated = await res.json();
      setPreviewImage(updated.imageUrl || previewImage);
      setFile(null);
      setSuccess("Vehicle updated successfully.");
      await queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update vehicle.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div className="flex flex-col gap-3">
        <Label>Photo</Label>
        <div className="relative w-full max-w-sm aspect-[4/3] overflow-hidden rounded-md border bg-muted/20">
          {previewImage ? (
            <Image
              src={previewImage}
              alt={form.name || "Vehicle"}
              fill
              className="object-contain p-2"
              unoptimized
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No photo
            </div>
          )}
        </div>
        <Input
          type="file"
          accept="image/*,.heic,.heif"
          onChange={(e) => {
            const nextFile = e.target.files?.[0] ?? null;
            setFile(nextFile);
            if (nextFile) {
              setPreviewImage(URL.createObjectURL(nextFile));
            }
          }}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          required
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="model">Model</Label>
        <Input
          id="model"
          value={form.model}
          onChange={(e) => setForm((prev) => ({ ...prev, model: e.target.value }))}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="year">Year</Label>
        <Input
          id="year"
          type="number"
          value={form.year}
          onChange={(e) => setForm((prev) => ({ ...prev, year: e.target.value }))}
          required
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="license">License plate</Label>
        <Input
          id="license"
          value={form.license_plate}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, license_plate: e.target.value }))
          }
          required
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-emerald-600">{success}</p>}

      <div className="flex justify-end">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
