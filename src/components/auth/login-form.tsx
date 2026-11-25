"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { NETWORK_ERROR, signInErrorMessage } from "@/lib/auth-errors";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // A transition, not a boolean: it ends with the navigation, so a page kept
  // alive by the router (Cache Components) never comes back stuck on "pending".
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        const { error } = await authClient.signIn.email({
          email: String(form.get("email")),
          password: String(form.get("password")),
        });
        if (error) {
          setError(signInErrorMessage(error));
          return;
        }
        router.replace("/dnes");
        router.refresh();
      } catch {
        setError(NETWORK_ERROR);
      }
    });
  }

  // method="post": a submit before hydration must never put the password in the URL.
  return (
    <form method="post" onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Heslo</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Přihlašuji…" : "Přihlásit se"}
      </Button>
    </form>
  );
}
