"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      const next = searchParams.get("next");
      router.push(next && next.startsWith("/") ? next : "/dashboard");
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTryDemo = async () => {
    const supabase = createClient();
    setIsDemoLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/demo-login", {
        method: "POST",
      });
      if (!res.ok) {
        let message = "Failed to start demo session.";
        try {
          const body = await res.json();
          if (typeof body?.error === "string" && body.error.trim()) {
            message = body.error;
          }
        } catch {}
        setError(message);
        return;
      }

      const payload = (await res.json()) as {
        data: { access_token: string; refresh_token: string };
      };
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: payload.data.access_token,
        refresh_token: payload.data.refresh_token,
      });
      if (sessionError) {
        setError(sessionError.message);
        return;
      }

      const next = searchParams.get("next");
      router.push(next && next.startsWith("/") ? next : "/dashboard");
      router.refresh();
    } catch {
      setError("Failed to start demo session.");
    } finally {
      setIsDemoLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>
            Enter your email below to login to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/auth/forgot-password"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                  >
                    Forgot your password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Logging in..." : "Login"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={isDemoLoading || isLoading}
                onClick={handleTryDemo}
              >
                {isDemoLoading ? "Starting demo..." : "Try Demo"}
              </Button>
            </div>
            <div className="mt-4 text-center text-sm">
              Don&apos;t have an account?{" "}
              <Link
                href="/auth/sign-up"
                className="underline underline-offset-4"
              >
                Sign up
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
      </motion.div>
    </div>
  );
}
