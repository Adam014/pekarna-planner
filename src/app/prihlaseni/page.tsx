import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Přihlášení",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-4 py-16">
      <Suspense>
        <RedirectIfSignedIn />
      </Suspense>
      <header className="flex flex-col gap-1">
        <p className="text-sm font-medium text-crust">Pekárna Planner</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Přihlášení pro pekárnu
        </h1>
      </header>
      <LoginForm />
      <Link
        href="/"
        className="inline-flex h-11 items-center text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        Zpět na objednávku
      </Link>
    </main>
  );
}

async function RedirectIfSignedIn() {
  if (await getCurrentUser()) redirect("/dnes");
  return null;
}
