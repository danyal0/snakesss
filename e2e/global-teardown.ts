import { request } from '@playwright/test';

export default async function globalTeardown(): Promise<void> {
  const ctx = await request.newContext();
  try {
    await ctx.post('http://127.0.0.1:3001/api/e2e/reset');
  } catch {
    // ignore
  } finally {
    await ctx.dispose();
  }
}
