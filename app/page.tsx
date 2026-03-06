"use client";
import { redirect } from "next/navigation";

export default function Home() {
  const verified = false;
  if (!verified) {
    redirect("/auth/login");
  }
  return <div>initial page </div>;
}
