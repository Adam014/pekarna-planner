import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = { title: "Design system" };

const colors = [
  ["background", "bg-background"],
  ["card", "bg-card"],
  ["muted", "bg-muted"],
  ["primary", "bg-primary"],
  ["crust", "bg-crust"],
  ["info", "bg-info"],
  ["success", "bg-success"],
  ["warning", "bg-warning"],
  ["destructive", "bg-destructive"],
] as const;

/** Reference of the tokens and components every screen is built from. */
export default function DesignPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-12">
      <header className="flex flex-col gap-1">
        <p className="text-sm font-medium text-crust">Pekárna Planner</p>
        <h1 className="text-3xl font-semibold tracking-tight">Design system</h1>
        <p className="text-muted-foreground">
          Tokeny a komponenty, ze kterých se skládá každá obrazovka.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Barvy</h2>
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {colors.map(([name, className]) => (
            <li key={name} className="flex flex-col gap-1.5">
              <span className={`h-12 rounded-lg border ${className}`} />
              <span className="text-sm">{name}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Typografie</h2>
        <p className="text-3xl font-semibold tracking-tight">
          Plán pečení na čtvrtek
        </p>
        <p className="text-lg font-medium">Rezervace na zítra</p>
        <p>Kváskový chléb 1 kg, rohlíky, koláče s tvarohem a povidly.</p>
        <p className="text-sm text-muted-foreground">
          Uzávěrka objednávek je den předem v 18:00.
        </p>
        <p className="tabular-nums">1 234,50 Kč · 12 ks · 08:30</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Tlačítka a stavy</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button>Uložit rezervaci</Button>
          <Button variant="secondary">Zrušit</Button>
          <Button variant="outline">Tisk</Button>
          <Button variant="ghost">Více</Button>
          <Button variant="destructive">Smazat</Button>
          <Button disabled>Nedostupné</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">Rezervováno</Badge>
          <Badge variant="success">Vydáno</Badge>
          <Badge variant="warning">Nevyzvednuto</Badge>
          <Badge variant="secondary">Zrušeno</Badge>
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Nová rezervace</CardTitle>
            <CardDescription>Zápis během telefonátu.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="phone">Telefon</Label>
              <Input id="phone" type="tel" placeholder="777 123 456" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Jméno</Label>
              <Input id="name" placeholder="Jana Nováková" />
            </div>
            <Button>Uložit rezervaci</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Plán pečení</CardTitle>
            <CardDescription>Čtvrtek 26. 11.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produkt</TableHead>
                  <TableHead className="text-right">Kusů</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="tabular-nums">
                <TableRow>
                  <TableCell>Kváskový chléb</TableCell>
                  <TableCell className="text-right">24</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Rohlík</TableCell>
                  <TableCell className="text-right">180</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Tvarohový koláč</TableCell>
                  <TableCell className="text-right">36</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
