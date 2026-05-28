"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { logoutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { navItems } from "@/lib/constants";
import { GitHubIcon } from "@/components/github-icon";
import { ThemeToggle } from "@/components/theme-toggle";

export function DashboardNav({
  appVersion,
  serverOriginUrl,
}: {
  appVersion: string;
  serverOriginUrl: string;
}) {
  const pathname = usePathname();
  const [releaseVersion, setReleaseVersion] = useState(appVersion);

  useEffect(() => {
    fetch("https://api.github.com/repos/cooderl/wewe-rss/releases/latest")
      .then((res) => res.json())
      .then((data) => {
        if (typeof data?.name === "string") {
          setReleaseVersion(data.name.replace(/^v/, ""));
        }
      })
      .catch(() => null);
  }, []);

  const isFoundNewVersion = releaseVersion > appVersion;

  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-6">
          <Link href="/dash/feeds" className="flex items-center gap-3">
            <img
              src={serverOriginUrl ? `${serverOriginUrl}/favicon.ico` : "/wewe-rss.png"}
              alt="WeWe RSS"
              className="h-8 w-8 rounded-md"
            />
            <div className="flex flex-col">
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                WeWe RSS
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                当前版本 v{appVersion}
                {isFoundNewVersion ? ` · 新版本 v${releaseVersion}` : ""}
              </span>
            </div>
          </Link>
          <nav className="hidden items-center gap-2 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition",
                  pathname.startsWith(item.href)
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <a
            href="https://github.com/cooderl/wewe-rss"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900"
          >
            <GitHubIcon />
          </a>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void logoutAction();
            }}
          >
            退出
          </Button>
        </div>
      </div>
    </header>
  );
}
