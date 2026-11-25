import { memoryAdapter } from "better-auth/adapters/memory";
import { beforeAll, describe, expect, it } from "vitest";
import { createAuth, SESSION_HOURS } from "./auth-config";

// The real auth config on an in-memory database. Passwords are random, so no
// test depends on Have I Been Pwned or on the network.
const db: Record<string, Record<string, unknown>[]> = {
  user: [],
  session: [],
  account: [],
  verification: [],
  rateLimit: [],
};
const auth = createAuth(memoryAdapter(db), { breachedPasswordCheck: false });

const password = "kvaskovy-chleb-1kg-v-patek";
const owner = {
  email: "owner@example.test",
  name: "Owner",
  role: "owner" as const,
};
const staff = {
  email: "staff@example.test",
  name: "Staff",
  role: "staff" as const,
};

async function signIn(email: string, pw = password) {
  const { headers, response } = await auth.api.signInEmail({
    body: { email, password: pw },
    returnHeaders: true,
  });
  const cookie = headers.get("set-cookie")?.split(";")[0] ?? "";
  return { response, headers: new Headers({ cookie }) };
}

function hoursUntil(date: Date) {
  return (date.getTime() - Date.now()) / 3_600_000;
}

beforeAll(async () => {
  await auth.api.createUser({ body: { ...owner, password } });
  await auth.api.createUser({ body: { ...staff, password } });
});

describe("auth config", () => {
  it("refuses public sign-up", async () => {
    await expect(
      auth.api.signUpEmail({
        body: { email: "x@example.test", password, name: "X" },
      }),
    ).rejects.toMatchObject({
      body: { code: "EMAIL_PASSWORD_SIGN_UP_DISABLED" },
    });
  });

  it("gives the same error for a wrong password and an unknown e-mail", async () => {
    await expect(
      auth.api.signInEmail({
        body: { email: staff.email, password: `${password}x` },
      }),
    ).rejects.toMatchObject({ body: { code: "INVALID_EMAIL_OR_PASSWORD" } });
    await expect(
      auth.api.signInEmail({
        body: { email: "nobody@example.test", password },
      }),
    ).rejects.toMatchObject({ body: { code: "INVALID_EMAIL_OR_PASSWORD" } });
  });

  it("ends an owner session after a working day and a staff session after a month", async () => {
    const ownerSession = await auth.api.getSession({
      headers: (await signIn(owner.email)).headers,
    });
    const staffSession = await auth.api.getSession({
      headers: (await signIn(staff.email)).headers,
    });
    expect(
      hoursUntil(ownerSession?.session.expiresAt ?? new Date()),
    ).toBeCloseTo(SESSION_HOURS.owner, 0);
    expect(
      hoursUntil(staffSession?.session.expiresAt ?? new Date()),
    ).toBeCloseTo(SESSION_HOURS.staff, 0);
  });

  it("lets only the owner use the account admin API", async () => {
    const asOwner = await signIn(owner.email);
    const asStaff = await signIn(staff.email);
    await expect(
      auth.api.listUsers({ headers: asOwner.headers, query: {} }),
    ).resolves.toMatchObject({
      total: 2,
    });
    await expect(
      auth.api.listUsers({ headers: asStaff.headers, query: {} }),
    ).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("keeps the shorter lifetime when the user does not want to be remembered", async () => {
    const { headers } = await auth.api.signInEmail({
      body: { email: owner.email, password, rememberMe: false },
      returnHeaders: true,
    });
    const cookie = new Headers({
      cookie: headers.get("set-cookie")?.split(";")[0] ?? "",
    });
    const staffSession = await auth.api.signInEmail({
      body: { email: staff.email, password, rememberMe: false },
      returnHeaders: true,
    });
    const staffCookie = new Headers({
      cookie: staffSession.headers.get("set-cookie")?.split(";")[0] ?? "",
    });
    const ownerExpiry = (await auth.api.getSession({ headers: cookie }))
      ?.session.expiresAt;
    const staffExpiry = (await auth.api.getSession({ headers: staffCookie }))
      ?.session.expiresAt;
    expect(hoursUntil(ownerExpiry ?? new Date())).toBeCloseTo(
      SESSION_HOURS.owner,
      0,
    );
    expect(hoursUntil(staffExpiry ?? new Date())).toBeCloseTo(24, 0);
  });

  it("does not let the owner create users, change roles or impersonate", async () => {
    const asOwner = await signIn(owner.email);
    const staffId = String(db.user?.find((u) => u.email === staff.email)?.id);
    const forbidden = { statusCode: 403 };
    await expect(
      auth.api.createUser({
        headers: asOwner.headers,
        body: {
          email: "y@example.test",
          password: "a",
          name: "Y",
          role: "owner",
        },
      }),
    ).rejects.toMatchObject(forbidden);
    await expect(
      auth.api.setRole({
        headers: asOwner.headers,
        body: { userId: staffId, role: "owner" },
      }),
    ).rejects.toMatchObject(forbidden);
    await expect(
      auth.api.impersonateUser({
        headers: asOwner.headers,
        body: { userId: staffId },
      }),
    ).rejects.toMatchObject(forbidden);
  });

  it("signs a banned user out everywhere and refuses new sign-ins", async () => {
    const asOwner = await signIn(owner.email);
    const asStaff = await signIn(staff.email);
    const staffUser = db.user?.find((u) => u.email === staff.email);
    await auth.api.banUser({
      headers: asOwner.headers,
      body: { userId: String(staffUser?.id) },
    });
    expect(await auth.api.getSession({ headers: asStaff.headers })).toBeNull();
    await expect(signIn(staff.email)).rejects.toMatchObject({
      body: { code: "BANNED_USER" },
    });
  });
});
