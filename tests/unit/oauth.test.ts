import { describe, expect, test } from "bun:test";
import { enabledProviders, readState, safeReturnTo, stateCookie } from "@/lib/server/oauth";

describe("OAuth: utilidades", () => {
  test("safeReturnTo solo admite rutas internas", () => {
    expect(safeReturnTo("/practice/notes")).toBe("/practice/notes");
    expect(safeReturnTo(null)).toBe("/");
    expect(safeReturnTo("https://evil.example")).toBe("/");
    expect(safeReturnTo("//evil.example")).toBe("/");
    expect(safeReturnTo("/api/auth/logout")).toBe("/");
  });

  test("la cookie de estado se recupera con state, verifier y returnTo", () => {
    const cookie = stateCookie({ state: "abc", verifier: "ver", returnTo: "/account" });
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Path=/api/auth/oauth");
    const value = cookie.split(";")[0]!;
    const req = new Request("http://x", { headers: { cookie: value } });
    expect(readState(req)).toEqual({ state: "abc", verifier: "ver", returnTo: "/account" });
    expect(readState(new Request("http://x"))).toBeNull();
    expect(readState(new Request("http://x", { headers: { cookie: "opus_oauth=%7Bbad" } }))).toBeNull();
  });

  test("el botón de Google solo se activa con las dos credenciales", () => {
    const saved = { id: process.env.GOOGLE_CLIENT_ID, secret: process.env.GOOGLE_CLIENT_SECRET };
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    expect(enabledProviders()).toEqual({ google: false });
    process.env.GOOGLE_CLIENT_ID = "id";
    expect(enabledProviders()).toEqual({ google: false });
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    expect(enabledProviders()).toEqual({ google: true });
    if (saved.id) process.env.GOOGLE_CLIENT_ID = saved.id; else delete process.env.GOOGLE_CLIENT_ID;
    if (saved.secret) process.env.GOOGLE_CLIENT_SECRET = saved.secret; else delete process.env.GOOGLE_CLIENT_SECRET;
  });
});
