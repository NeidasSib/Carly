"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

type ProfilePayload = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  avatar_signed_url: string | null;
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

async function fetchProfile() {
  const res = await fetch("/api/profile");
  if (!res.ok) throw new Error("Failed to load profile.");
  return (await res.json()) as { data: ProfilePayload | null };
}

function createObjectId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getFileExtension(file: File) {
  const byType = file.type.split("/")[1];
  if (byType) return byType.replace(/[^a-zA-Z0-9]/g, "");
  const byName = file.name.split(".").pop();
  if (byName) return byName.replace(/[^a-zA-Z0-9]/g, "");
  return "jpg";
}

async function uploadAvatar(file: File, userId: string) {
  const supabase = createClient();
  const ext = getFileExtension(file);
  const path = `private/${userId}/profile/${createObjectId()}.${ext}`;
  const { error } = await supabase.storage.from("vehicle-photos").upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
    cacheControl: "3600",
  });
  if (error) {
    throw new Error(error.message || "Failed to upload avatar.");
  }
  return path;
}

export default function ProfilePage() {
  const router = useRouter();
  const { data, refetch } = useQuery({
    queryKey: ["profile-settings"],
    queryFn: fetchProfile,
  });

  const profile = data?.data ?? null;
  const [displayName, setDisplayName] = useState("");
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name ?? "");
    setAvatarPath(profile.avatar_url ?? null);
    setAvatarPreviewUrl(profile.avatar_signed_url ?? null);
  }, [profile]);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedAvatarFile(file);
    setAvatarPreviewUrl(URL.createObjectURL(file));
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      let nextAvatarPath = avatarPath;

      if (selectedAvatarFile) {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setError("You are not authenticated.");
          return;
        }

        nextAvatarPath = await uploadAvatar(selectedAvatarFile, user.id);
      }

      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName,
          avatar_url: nextAvatarPath,
        }),
      });

      if (!res.ok) {
        setError(await getResponseErrorMessage(res));
        return;
      }

      const payload = (await res.json()) as { data: ProfilePayload };
      setSelectedAvatarFile(null);
      setAvatarPath(payload.data.avatar_url);
      setAvatarPreviewUrl(payload.data.avatar_signed_url);
      await refetch();
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save profile.");
    } finally {
      setIsSaving(false);
    }
  }

  function removeAvatar() {
    setSelectedAvatarFile(null);
    setAvatarPath(null);
    setAvatarPreviewUrl(null);
  }

  async function deleteAccount() {
    setError(null);
    setIsDeleting(true);
    try {
      const res = await fetch("/api/profile", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePassword }),
      });
      if (!res.ok) {
        setError(await getResponseErrorMessage(res));
        return;
      }
      setDeletePassword("");
      router.push("/auth/login");
      router.refresh();
    } catch {
      setError("Failed to delete account.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="grid gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Profile settings</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={saveProfile}>
            <div className="flex items-center gap-3">
              <Avatar className="size-16">
                <AvatarImage src={avatarPreviewUrl ?? undefined} />
                <AvatarFallback>
                  {(displayName || "P").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="grid gap-2">
                <Label htmlFor="avatar">Profile picture</Label>
                <Input
                  id="avatar"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-fit"
                  onClick={removeAvatar}
                >
                  Remove picture
                </Button>
              </div>
            </div>

            <div className="grid gap-2 max-w-sm">
              <Label htmlFor="display-name">Display name</Label>
              <Input
                id="display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                required
              />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <div className="flex gap-2">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save profile"}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive">
                    Delete account
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete account?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently removes your account data. If you are the
                      only owner of a company, transfer ownership or delete that
                      company first.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="grid gap-2">
                    <Label htmlFor="delete-account-password">
                      Confirm password
                    </Label>
                    <Input
                      id="delete-account-password"
                      type="password"
                      value={deletePassword}
                      onChange={(event) => setDeletePassword(event.target.value)}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      disabled={isDeleting}
                    />
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={isDeleting || !deletePassword.trim()}
                      onClick={async (event) => {
                        event.preventDefault();
                        await deleteAccount();
                      }}
                    >
                      {isDeleting ? "Deleting..." : "Delete account"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
