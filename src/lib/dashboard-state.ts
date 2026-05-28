type HistoryProgress = {
  id: string;
  page: number;
};

type DashboardState = {
  blockedAccountsMap: Map<string, string[]>;
  inProgressHistoryMp: HistoryProgress;
  isRefreshAllMpArticlesRunning: boolean;
};

declare global {
  // eslint-disable-next-line no-var
  var __weweRssDashboardState__: DashboardState | undefined;
}

export const dashboardState: DashboardState =
  global.__weweRssDashboardState__ ?? {
    blockedAccountsMap: new Map<string, string[]>(),
    inProgressHistoryMp: { id: "", page: 1 },
    isRefreshAllMpArticlesRunning: false,
  };

if (process.env.NODE_ENV !== "production") {
  global.__weweRssDashboardState__ = dashboardState;
}

export function getHistoryProgress() {
  return dashboardState.inProgressHistoryMp;
}

export function setHistoryProgress(id: string, page: number) {
  dashboardState.inProgressHistoryMp = { id, page };
}

export function clearHistoryProgress() {
  dashboardState.inProgressHistoryMp = { id: "", page: 1 };
}
