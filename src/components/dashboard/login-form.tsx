"use client";

import { useState, useTransition } from "react";

import { loginAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const [authCode, setAuthCode] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData();
        formData.set("authCode", authCode);

        startTransition(async () => {
          const result = await loginAction({ error: "" }, formData);
          setError(result.error);
        });
      }}
    >
      <div className="space-y-2">
        <label
          htmlFor="authCode"
          className="text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          AuthCode
        </label>
        <Input
          id="authCode"
          name="authCode"
          value={authCode}
          onChange={(event) => setAuthCode(event.target.value)}
          placeholder="请输入 auth code"
          autoFocus
        />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "验证中..." : "确认"}
      </Button>
    </form>
  );
}
