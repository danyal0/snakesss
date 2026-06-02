import { request } from '@playwright/test';

const SERVER = 'http://127.0.0.1:3001';

export default async function globalSetup(): Promise<void> {
  const ctx = await request.newContext();
  try {
    await ctx.post(`${SERVER}/api/e2e/reset`);
    await ctx.post(`${SERVER}/api/e2e/seed`, { data: { seed: 'e2e-global' } });
  } catch {
    // Server may not be up yet — webServer will start it
  } finally {
    await ctx.dispose();
  }
}
