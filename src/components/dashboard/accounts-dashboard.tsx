"use client";

import type { Account } from "@prisma/client";
import dayjs from "dayjs";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { deleteAccountAction, setAccountStatusAction } from "@/actions/dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { statusMeta, STATUS } from "@/lib/constants";

type LoginPayload = {
  uuid: string;
  scanUrl: string;
};

type LoginResult = {
  message: string;
  vid?: number;
  token?: string;
  username?: string;
};

export function AccountsDashboard({
  accounts,
  blockedIds,
}: {
  accounts: Account[];
  blockedIds: string[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [modalOpen, setModalOpen] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [loginPayload, setLoginPayload] = useState<LoginPayload | null>(null);
  const [loginResult, setLoginResult] = useState<LoginResult | null>(null);

  useEffect(() => {
    if (!modalOpen || countdown <= 0) {
      return;
    }

    const timer = window.setTimeout(() => setCountdown((value) => value - 1), 1_000);
    return () => window.clearTimeout(timer);
  }, [countdown, modalOpen]);

  useEffect(() => {
    if (!modalOpen || !loginPayload?.uuid || loginResult?.message) {
      return;
    }

    const timer = window.setInterval(async () => {
      const response = await fetch(
        `/api/dashboard/accounts/login-result?id=${loginPayload.uuid}`,
        {
          cache: "no-store",
        },
      );

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as LoginResult;
      setLoginResult(payload);

      if (payload.vid && payload.token) {
        toast.success(`添加成功：${payload.username || payload.vid}`);
        setModalOpen(false);
        router.refresh();
      }
    }, 3_000);

    return () => window.clearInterval(timer);
  }, [loginPayload?.uuid, loginResult?.message, modalOpen, router]);

  const openLoginModal = () => {
    setModalOpen(true);
    setLoginPayload(null);
    setLoginResult(null);
    startTransition(async () => {
      const response = await fetch("/api/dashboard/accounts/login-url", {
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.message || "二维码加载失败");
        setModalOpen(false);
        return;
      }

      setLoginPayload(payload);
      setCountdown(60);
    });
  };

  return (
    <>
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 dark:border-slate-800">
          <div className="text-sm text-slate-500">共 {accounts.length} 个账号</div>
          <Button size="sm" onClick={openLoginModal} disabled={isPending}>
            添加读书账号
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                {["ID", "用户名", "状态", "更新时间", "操作"].map((title) => (
                  <th
                    key={title}
                    className="px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-200"
                  >
                    {title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
              {accounts.length ? (
                accounts.map((account) => {
                  const isBlocked = blockedIds.includes(account.id);

                  return (
                    <tr key={account.id}>
                      <td className="px-4 py-3 text-sm">{account.id}</td>
                      <td className="px-4 py-3 text-sm">{account.name}</td>
                      <td className="px-4 py-3 text-sm">
                        {isBlocked ? (
                          <Badge tone="warning">今日小黑屋</Badge>
                        ) : (
                          <Badge
                            tone={
                              statusMeta[account.status as keyof typeof statusMeta]?.tone || "neutral"
                            }
                          >
                            {statusMeta[account.status as keyof typeof statusMeta]?.label || "未知"}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {dayjs(account.updatedAt).format("YYYY-MM-DD")}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          <select
                            value={account.status}
                            onChange={(event) => {
                              const status = Number(event.target.value);
                              startTransition(async () => {
                                await setAccountStatusAction(account.id, status);
                                toast.success("状态已更新");
                                router.refresh();
                              });
                            }}
                            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
                          >
                            <option value={STATUS.ENABLE}>启用</option>
                            <option value={STATUS.DISABLE}>禁用</option>
                            <option value={STATUS.INVALID}>失效</option>
                          </select>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              startTransition(async () => {
                                await deleteAccountAction(account.id);
                                toast.success("账号已删除");
                                router.refresh();
                              });
                            }}
                          >
                            删除
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400"
                  >
                    暂无数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="添加读书账号"
      >
        <div className="flex min-h-[260px] flex-col items-center justify-center gap-4 text-center">
          {loginPayload ? (
            <>
              <div className="relative rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                {loginResult?.message ? (
                  <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/90 px-6 text-sm text-slate-700 dark:bg-slate-950/90 dark:text-slate-200">
                    {loginResult.message}
                  </div>
                ) : null}
                <QRCodeSVG size={180} value={loginPayload.scanUrl} />
              </div>
              <p className="text-sm text-slate-500">
                微信扫码登录 {countdown > 0 && !loginResult?.message ? `(${countdown}s)` : ""}
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-500">二维码加载中...</p>
          )}
        </div>
      </Modal>
    </>
  );
}
