import { describe, expect, it } from "vitest";
import { CONTACT_KEY, readContact, writeContact } from "./saved-contact";

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

const broken = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
  removeItem: () => {
    throw new Error("SecurityError");
  },
};

describe("saved contact", () => {
  it("saves, reads and forgets name and phone", () => {
    const storage = memory();
    writeContact({ name: "Jana", phone: "601 234 567" }, storage);
    expect(readContact(storage)).toEqual({
      name: "Jana",
      phone: "601 234 567",
    });
    writeContact(null, storage);
    expect(storage.data.has(CONTACT_KEY)).toBe(false);
  });

  it("ignores a broken or foreign value", () => {
    expect(readContact(memory({ [CONTACT_KEY]: "{not json" }))).toBeNull();
    expect(readContact(memory({ [CONTACT_KEY]: '{"name":1}' }))).toBeNull();
    expect(readContact(memory({ [CONTACT_KEY]: "null" }))).toBeNull();
  });

  it("works without storage and when storage throws", () => {
    expect(readContact(null)).toBeNull();
    expect(readContact(broken)).toBeNull();
    expect(() =>
      writeContact({ name: "Jana", phone: "1" }, broken),
    ).not.toThrow();
    expect(() => writeContact(null, broken)).not.toThrow();
  });
});
