import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ImageIcon, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

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

type props = {
  workspace: string;
  onClose: () => void;
  onSuccess?: () => void;
};

export default function AddVehicleModal({
  workspace,
  onClose,
  onSuccess,
}: props) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    model: "",
    year: "",
    license_plate: "",
    image: "",
    vin: "",
    fuel_type: "",
    transmission: "",
    insurance_valid_until: "",
    inspection_valid_until: "",
    road_tax_valid_until: "",
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setErrorDetails(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("You must be signed in to add a vehicle.");
      return;
    }

    if (!file) {
      setError("Vehicle photo is required.");
      return;
    }

    let imagePath = form.image ?? "";
    try {
      imagePath = await uploadVehiclePhoto(file, user.id);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to upload photo.";
      setError("Photo upload failed.");
      setErrorDetails(
        `Reason: ${message}\nFile: ${file.name || "unknown"}\nType: ${
          file.type || "unknown"
        }\nSize: ${(file.size / (1024 * 1024)).toFixed(2)} MB`
      );
      return;
    }

    const params = new URLSearchParams({ ws: workspace });
    const res = await fetch(`/api/vehicles?${params.toString()}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...form,
        year: Number(form.year),
        image: imagePath,
        workspace,
      }),
    });

    if (!res.ok) {
      const message = await getResponseErrorMessage(res);
      setError("Failed to add vehicle.");
      setErrorDetails(message);
      return;
    }

    onSuccess?.();
    onClose();
    router.refresh();
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Vehicle</DialogTitle>
          <DialogDescription>
            Fill in the details of your new vehicle.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          {error && (
            <div
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              <p className="font-medium">{error}</p>
              {errorDetails && (
                <p className="mt-1 whitespace-pre-wrap break-words text-xs text-destructive/90">
                  {errorDetails}
                </p>
              )}
            </div>
          )}
          <Input
            name="name"
            placeholder="Vehicle Name"
            value={form.name}
            onChange={handleChange}
            required
          />

          <Input
            name="model"
            placeholder="Model"
            value={form.model}
            onChange={handleChange}
          />

          <Input
            name="year"
            type="number"
            placeholder="Year"
            value={form.year}
            onChange={handleChange}
          />

          <Input
            name="license_plate"
            placeholder="License Plate"
            value={form.license_plate}
            onChange={handleChange}
            required
          />

          <Input
            name="vin"
            placeholder="VIN (optional)"
            value={form.vin}
            onChange={handleChange}
          />

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="fuel-type">Fuel type</Label>
              <Select
                value={form.fuel_type || "none"}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    fuel_type: value === "none" ? "" : value,
                  }))
                }
              >
                <SelectTrigger id="fuel-type">
                  <SelectValue placeholder="Select fuel type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  <SelectItem value="petrol">Petrol</SelectItem>
                  <SelectItem value="diesel">Diesel</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                  <SelectItem value="electric">Electric</SelectItem>
                  <SelectItem value="lpg">LPG</SelectItem>
                  <SelectItem value="cng">CNG</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="transmission">Transmission</Label>
              <Select
                value={form.transmission || "none"}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    transmission: value === "none" ? "" : value,
                  }))
                }
              >
                <SelectTrigger id="transmission">
                  <SelectValue placeholder="Select transmission" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="automatic">Automatic</SelectItem>
                  <SelectItem value="cvt">CVT</SelectItem>
                  <SelectItem value="semi_automatic">Semi automatic</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label>Insurance valid until</Label>
              <DatePicker
                value={form.insurance_valid_until}
                onChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    insurance_valid_until: value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Inspection valid until</Label>
              <DatePicker
                value={form.inspection_valid_until}
                onChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    inspection_valid_until: value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Road tax valid until</Label>
              <DatePicker
                value={form.road_tax_valid_until}
                onChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    road_tax_valid_until: value,
                  }))
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vehicle-photo">Vehicle photo</Label>
            <Label
              htmlFor="vehicle-photo"
              className={cn(
                "flex h-9 w-full cursor-pointer items-center gap-2 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none",
                "hover:bg-muted/50 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
                "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
                "md:text-sm dark:bg-input/30"
              )}
            >
              <ImageIcon className="size-4 shrink-0 text-muted-foreground" />
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-left",
                  file ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {file ? file.name : "Choose a photo..."}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="pointer-events-none shrink-0"
                asChild
              >
                <span className="flex items-center gap-1.5">
                  <Upload className="size-3.5" />
                  Browse
                </span>
              </Button>
              <input
                id="vehicle-photo"
                type="file"
                accept="image/*,.heic,.heif"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="sr-only"
              />
            </Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>

            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
