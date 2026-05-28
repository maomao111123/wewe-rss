import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

import { getEnv, isAuthEnabled } from "@/lib/config";

export const SESSION_COOKIE_NAME = "wewe_rss_session";

function buildSessionValue() {
  const authCode = getEnv().AUTH_CODE;
  return createHash("sha256").update(`wewe-rss:${authCode}`).digest("hex");
}

export function isAuthorizedCookie(cookieValue?: string | null) {
  if (!isAuthEnabled()) {
    return true;
  }

  return cookieValue === buildSessionValue();
}

export async function getDashboardSession() {
  if (!isAuthEnabled()) {
    return true;
  }

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return isAuthorizedCookie(sessionCookie);
}

export async function requireDashboardSession() {
  const isAuthorized = await getDashboardSession();
  if (!isAuthorized) {
    redirect("/dash/login");
  }
}

export function assertDashboardRequest(request: NextRequest) {
  const cookieValue = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  return isAuthorizedCookie(cookieValue);
}

export async function createDashboardSession() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, buildSessionValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearDashboardSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
