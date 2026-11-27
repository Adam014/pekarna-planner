/**
 * Made-up demo data (R8): products, standing orders and a week of
 * reservations, so the bake plan and "Dnes" are not empty. Everything goes
 * through the services, so the daily limit and the other rules hold. Dates are
 * counted from the day the seed runs; to move the demo to another week, run
 * the seed with `--reset`.
 *
 * The phone numbers are in a real mobile range: Czechia has no range reserved
 * for fiction, and the app only stores them, it never calls or texts.
 */
import { randomUUID } from "node:crypto";
import { addDays, TIME_ZONE, today, weekdayOf } from "../domain/time";
import {
  createReservation,
  setReservationStatus,
} from "../services/reservations.service";
import { saveStandingOrder } from "../services/standing-orders.service";
import type { ReservationStatus } from "../domain/reservation";
import type { Db } from "./types";
import {
  customer,
  product,
  reservation,
  reservationItem,
  standingOrder,
  standingOrderItem,
} from "./schema";

const OPEN_DAYS = [1, 2, 3, 4, 5, 6];

// Demo photos are generated product shots in public/products.
const PRODUCTS = [
  {
    name: "Rohlík",
    imageUrl: "/products/rohlik.webp",
    price: 450,
    dailyLimit: 300,
    buffer: 40,
  },
  {
    name: "Kaiserka",
    imageUrl: "/products/kaiserka.webp",
    price: 600,
    dailyLimit: 150,
    buffer: 20,
  },
  {
    name: "Kváskový chléb",
    imageUrl: "/products/kvaskovy-chleb.webp",
    price: 7900,
    dailyLimit: 40,
    buffer: 6,
  },
  {
    name: "Celozrnný chléb",
    imageUrl: "/products/celozrnny-chleb.webp",
    price: 6900,
    dailyLimit: 20,
    buffer: 3,
    bakeDays: [2, 4, 6],
  },
  {
    name: "Croissant",
    imageUrl: "/products/croissant.webp",
    price: 3900,
    dailyLimit: 60,
    buffer: 10,
  },
  {
    name: "Bageta",
    imageUrl: "/products/bageta.webp",
    price: 3500,
    dailyLimit: 50,
    buffer: 8,
  },
  {
    name: "Tvarohový koláč",
    imageUrl: "/products/tvarohovy-kolac.webp",
    price: 2900,
    dailyLimit: 40,
    buffer: 6,
  },
  {
    name: "Makové buchty",
    imageUrl: "/products/makove-buchty.webp",
    price: 3200,
    dailyLimit: 30,
    buffer: 5,
  },
  {
    name: "Vánočka",
    imageUrl: "/products/vanocka.webp",
    price: 14900,
    dailyLimit: 15,
    buffer: 2,
    bakeDays: [5, 6],
  },
];

type Items = [productName: string, quantity: number][];

const STANDING_ORDERS: {
  customerName: string;
  phone: string;
  weekdays: number[];
  pickupTime: string;
  note?: string;
  items: Items;
}[] = [
  {
    customerName: "Kavárna U Mostu",
    phone: "+420 777 000 101",
    weekdays: [1, 2, 3, 4, 5],
    pickupTime: "06:45",
    items: [
      ["Croissant", 15],
      ["Rohlík", 40],
    ],
  },
  {
    customerName: "MŠ Sluníčko",
    phone: "+420 777 000 102",
    weekdays: [1, 2, 3, 4, 5],
    pickupTime: "06:30",
    note: "Vyzvedává paní kuchařka zadním vchodem",
    items: [
      ["Rohlík", 60],
      ["Kváskový chléb", 3],
    ],
  },
  {
    customerName: "Bistro Na Rohu",
    phone: "+420 777 000 103",
    weekdays: [2, 4, 6],
    pickupTime: "09:00",
    items: [
      ["Bageta", 20],
      ["Celozrnný chléb", 4],
    ],
  },
];

/** Orders per open day, counted from today; the first day may be today. */
const ORDERS: {
  day: number;
  customerName: string;
  phone: string;
  pickupTime?: string;
  note?: string;
  items: Items;
  /** What staff already marked on "Dnes" (today's orders only). */
  status?: ReservationStatus;
}[] = [
  {
    day: 0,
    customerName: "Jana Dvořáková",
    phone: "+420 777 000 201",
    pickupTime: "08:00",
    items: [
      ["Kváskový chléb", 1],
      ["Rohlík", 10],
    ],
    status: "picked_up",
  },
  {
    day: 0,
    customerName: "Petr Svoboda",
    phone: "+420 777 000 202",
    pickupTime: "09:30",
    items: [["Croissant", 4]],
    status: "picked_up",
  },
  {
    day: 0,
    customerName: "Lucie Králová",
    phone: "+420 777 000 203",
    pickupTime: "10:00",
    items: [["Tvarohový koláč", 6]],
    status: "no_show",
  },
  {
    day: 0,
    customerName: "Martin Procházka",
    phone: "+420 777 000 204",
    pickupTime: "15:00",
    items: [
      ["Bageta", 2],
      ["Kaiserka", 6],
    ],
  },
  {
    day: 0,
    customerName: "Eva Černá",
    phone: "+420 777 000 205",
    pickupTime: "16:30",
    note: "Chléb prosím nakrájet",
    items: [["Kváskový chléb", 2]],
  },
  {
    day: 1,
    customerName: "Tomáš Veselý",
    phone: "+420 777 000 206",
    pickupTime: "07:30",
    items: [["Rohlík", 20]],
  },
  {
    day: 1,
    customerName: "Hana Marková",
    phone: "+420 777 000 207",
    items: [
      ["Makové buchty", 8],
      ["Croissant", 2],
    ],
  },
  {
    day: 1,
    customerName: "Jana Dvořáková",
    phone: "+420 777 000 201",
    pickupTime: "08:00",
    items: [["Kaiserka", 4]],
  },
  {
    day: 2,
    customerName: "Ondřej Pokorný",
    phone: "+420 777 000 208",
    pickupTime: "10:00",
    note: "Na oslavu, vyzvedne manželka",
    items: [
      ["Tvarohový koláč", 12],
      ["Makové buchty", 12],
    ],
  },
  {
    day: 2,
    customerName: "Klára Němcová",
    phone: "+420 777 000 209",
    items: [["Bageta", 3]],
  },
  {
    day: 2,
    customerName: "Petr Svoboda",
    phone: "+420 777 000 202",
    pickupTime: "09:30",
    items: [["Croissant", 4]],
  },
  {
    day: 3,
    customerName: "Lukáš Horák",
    phone: "+420 777 000 210",
    pickupTime: "07:00",
    items: [
      ["Rohlík", 15],
      ["Kváskový chléb", 1],
    ],
  },
  {
    day: 3,
    customerName: "Věra Kučerová",
    phone: "+420 777 000 211",
    items: [
      ["Kváskový chléb", 1],
      ["Vánočka", 2],
      ["Celozrnný chléb", 1],
    ],
  },
  {
    day: 4,
    customerName: "Restaurace Zlatý Klas",
    phone: "+420 777 000 212",
    pickupTime: "08:30",
    note: "Zaplatí fakturou",
    items: [
      ["Kaiserka", 40],
      ["Bageta", 10],
    ],
  },
  {
    day: 4,
    customerName: "Eva Černá",
    phone: "+420 777 000 205",
    items: [
      ["Rohlík", 6],
      ["Vánočka", 1],
    ],
  },
  {
    day: 5,
    customerName: "Hana Marková",
    phone: "+420 777 000 207",
    pickupTime: "11:00",
    items: [
      ["Tvarohový koláč", 4],
      ["Croissant", 6],
    ],
  },
  {
    day: 5,
    customerName: "Jiří Beneš",
    phone: "+420 777 000 213",
    items: [["Kváskový chléb", 2]],
  },
  {
    day: 6,
    customerName: "Lucie Králová",
    phone: "+420 777 000 203",
    pickupTime: "10:00",
    items: [
      ["Makové buchty", 6],
      ["Rohlík", 10],
    ],
  },
  {
    day: 6,
    customerName: "Martin Procházka",
    phone: "+420 777 000 204",
    items: [
      ["Kaiserka", 4],
      ["Celozrnný chléb", 2],
    ],
  },
];

/** The first open days from today on, today included when it is open. */
function openDays(now: Temporal.Instant, count: number): string[] {
  const days: string[] = [];
  for (let date = today(now); days.length < count; date = addDays(date, 1)) {
    if (OPEN_DAYS.includes(weekdayOf(date))) days.push(date);
  }
  return days;
}

/**
 * Adds the demo data, unless there already are products. The standing orders
 * are saved as of yesterday, so they already have today's day like in a
 * bakery that has been running for a while. Orders for today and
 * the next open day are taken by staff on the phone (that day's online cutoff
 * may have passed); later ones alternate between phone and online. A product
 * not baked on the order's day (Vánočka, Celozrnný chléb) is left out of that
 * order; every order also has a product baked daily, so none disappears.
 */
export async function seedDemo(
  db: Db,
  now: Temporal.Instant,
  staffUserId: string,
): Promise<"created" | "skipped"> {
  const [existing] = await db.select({ id: product.id }).from(product).limit(1);
  if (existing) return "skipped";

  const products = await db
    .insert(product)
    .values(PRODUCTS.map((p) => ({ bakeDays: OPEN_DAYS, ...p })))
    .returning();
  const byName = new Map(products.map((p) => [p.name, p]));
  const toItems = (items: Items, date?: string) =>
    items.flatMap(([name, quantity]) => {
      const p = byName.get(name);
      if (!p) throw new Error(`Unknown demo product ${name}`);
      if (date && !p.bakeDays.includes(weekdayOf(date))) return [];
      return [{ productId: p.id, quantity }];
    });

  const yesterday = Temporal.PlainDate.from(addDays(today(now), -1))
    .toZonedDateTime(TIME_ZONE)
    .toInstant();
  for (const order of STANDING_ORDERS) {
    const result = await saveStandingOrder(
      db,
      { ...order, items: toItems(order.items) },
      yesterday,
    );
    if (result.status !== "saved" || result.skipped.length > 0) {
      throw new Error(`Standing order ${order.customerName} not saved`);
    }
  }

  const days = openDays(now, Math.max(...ORDERS.map((o) => o.day)) + 1);
  for (const [index, order] of ORDERS.entries()) {
    const date = days[order.day];
    if (!date) throw new Error(`No open day ${order.day}`);
    // Today's marks make sense only when the first open day is today.
    const status = date === today(now) ? order.status : undefined;
    const items = toItems(order.items, date);

    const result = await createReservation(
      db,
      {
        customerName: order.customerName,
        phone: order.phone,
        pickupDate: date,
        pickupTime: order.pickupTime,
        note: order.note,
        items,
        idempotencyKey: randomUUID(),
      },
      order.day < 2 || index % 2 === 0
        ? { source: "phone", userId: staffUserId }
        : { source: "online" },
      now,
    );
    if (result.status !== "created") {
      throw new Error(
        `Demo order of ${order.customerName} not saved: ${result.status}`,
      );
    }
    if (
      status &&
      (await setReservationStatus(db, result.reservationId, status, now))
        .status !== "updated"
    ) {
      throw new Error(`Demo order of ${order.customerName} not marked`);
    }
  }
  return "created";
}

/** Deletes all demo data (not the accounts or the settings), for `--reset`. */
export async function resetDemo(db: Db): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(reservationItem);
    await tx.delete(reservation);
    await tx.delete(standingOrderItem);
    await tx.delete(standingOrder);
    await tx.delete(customer);
    await tx.delete(product);
  });
}
