import { describe, expect, test } from "bun:test";
import { COOKIE, clearedCookie, hashToken, readCookie, sessionCookie } from "@/lib/server/session";
import { sameOrigin } from "@/lib/server/auth";

describe("cookies de sesión", () => {
  test("la cookie es HttpOnly, SameSite=Lax y caduca cuando la sesión", () => {
    const expires = new Date("2030-01-01T00:00:00Z");
    const c = sessionCookie("tok_en-123", expires);
    expect(c).toContain(`${COOKIE}=tok_en-123`);
    expect(c).toContain("HttpOnly");
    expect(c).toContain("SameSite=Lax");
    expect(c).toContain("Path=/");
    expect(c).toContain(expires.toUTCString());
  });

  test("la cookie de borrado tiene Max-Age=0", () => {
    expect(clearedCookie()).toContain("Max-Age=0");
  });

  test("readCookie encuentra la cookie entre varias", () => {
    const req = new Request("http://x", { headers: { cookie: `a=1; ${COOKIE}=abc%3D; b=2` } });
    expect(readCookie(req, COOKIE)).toBe("abc=");
    expect(readCookie(req, "zzz")).toBeNull();
  });

  test("el hash del token es estable y no revela el token", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
    expect(hashToken("abc")).not.toContain("abc");
  });
});

describe("comprobación de origen (CSRF)", () => {
  test("acepta el mismo host y rechaza otros", () => {
    const ok = new Request("http://x/api", { headers: { origin: "https://opus.example", host: "opus.example" } });
    const bad = new Request("http://x/api", { headers: { origin: "https://evil.example", host: "opus.example" } });
    const proxied = new Request("http://x/api", {
      headers: { origin: "https://opus.example", host: "web:3000", "x-forwarded-host": "opus.example" },
    });
    expect(sameOrigin(ok)).toBe(true);
    expect(sameOrigin(bad)).toBe(false);
    expect(sameOrigin(proxied)).toBe(true);
  });
});
