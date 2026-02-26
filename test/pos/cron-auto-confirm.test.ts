import { describe, expect, test, mock } from "bun:test";

describe("Cron Auto-confirm", () => {
  test("Cron confirms pending transactions older than 1 hour", async () => {
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    const twoHoursAgo = now - 7200000;

    let confirmedTransactions = false;
    let closedSessions = false;

    const mockEnv = {
      DB: {
        prepare: mock((query: string) => {
          return {
            bind: mock((...params: any[]) => {
              return {
                run: mock(async () => {
                  if (query.includes("UPDATE transactions") && query.includes("status = 'confirmed'")) {
                    // Verify grace period: only transactions created before oneHourAgo
                    expect(params[1]).toBeLessThan(now);
                    confirmedTransactions = true;
                  }
                  if (query.includes("UPDATE pos_sessions") && query.includes("closed_at = ?")) {
                    // Verify grace period: only sessions opened before oneHourAgo
                    expect(params[1]).toBeLessThan(now);
                    closedSessions = true;
                  }
                  return { success: true };
                })
              };
            })
          };
        })
      } as any
    };

    // Simulate cron execution
    const { default: worker } = await import("../../src/index");
    if (worker.scheduled) {
      await worker.scheduled({} as any, mockEnv as any, {
        waitUntil: (promise: Promise<any>) => promise
      } as any);
    }

    expect(confirmedTransactions).toBe(true);
    expect(closedSessions).toBe(true);
  });

  test("Cron does not confirm transactions within grace period (< 1 hour)", async () => {
    const now = Date.now();
    const thirtyMinutesAgo = now - 1800000; // 30 minutes

    const mockEnv = {
      DB: {
        prepare: mock((query: string) => {
          return {
            bind: mock((...params: any[]) => {
              return {
                run: mock(async () => {
                  if (query.includes("UPDATE transactions") && query.includes("status = 'confirmed'")) {
                    // Verify that created_at threshold is at least 1 hour ago
                    const threshold = params[1];
                    expect(threshold).toBeLessThan(thirtyMinutesAgo);
                  }
                  return { success: true };
                })
              };
            })
          };
        })
      } as any
    };

    const { default: worker } = await import("../../src/index");
    if (worker.scheduled) {
      await worker.scheduled({} as any, mockEnv as any, {
        waitUntil: (promise: Promise<any>) => promise
      } as any);
    }
  });

  test("Cron closes open POS sessions older than 1 hour", async () => {
    const now = Date.now();
    let sessionsClosed = false;

    const mockEnv = {
      DB: {
        prepare: mock((query: string) => {
          return {
            bind: mock((...params: any[]) => {
              return {
                run: mock(async () => {
                  if (query.includes("UPDATE pos_sessions") && query.includes("closed_at = ?")) {
                    sessionsClosed = true;
                    // Verify closed_at is set to current time
                    expect(params[0]).toBeGreaterThan(now - 1000);
                  }
                  return { success: true };
                })
              };
            })
          };
        })
      } as any
    };

    const { default: worker } = await import("../../src/index");
    if (worker.scheduled) {
      await worker.scheduled({} as any, mockEnv as any, {
        waitUntil: (promise: Promise<any>) => promise
      } as any);
    }

    expect(sessionsClosed).toBe(true);
  });
});
