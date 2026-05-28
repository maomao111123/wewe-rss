"use server";

import { redirect } from "next/navigation";

import { clearDashboardSession, createDashboardSession } from "@/lib/session";
import { getEnv } from "@/lib/config";

export type LoginActionState = {
  error: string;
};

export async function loginAction(
  _prevState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const authCode = String(formData.get("authCode") || "");
  const expectedAuthCode = getEnv().AUTH_CODE;

  if (!expectedAuthCode || authCode === expectedAuthCode) {
    await createDashboardSession();
    redirect("/dash/feeds");
  }

  return {
    error: "AuthCode 不正确",
  };
}

export async function logoutAction() {
  await clearDashboardSession();
  redirect("/dash/login");
}
