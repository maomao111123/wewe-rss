type DashboardState = {
  blockedAccountsMap: Map<string, string[]>;
};

declare global {
  // eslint-disable-next-line no-var
  var __weweRssDashboardState__: DashboardState | undefined;
}

export const dashboardState: DashboardState =
  global.__weweRssDashboardState__ ?? {
    blockedAccountsMap: new Map<string, string[]>(),
  };

if (process.env.NODE_ENV !== 'production') {
  global.__weweRssDashboardState__ = dashboardState;
}
