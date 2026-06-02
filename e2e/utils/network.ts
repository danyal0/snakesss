import type { Page } from '@playwright/test';

export type NetworkProfile = 'offline' | 'slow-3g' | 'fast-3g' | 'none';

const PROFILES: Record<Exclude<NetworkProfile, 'none'>, { offline: boolean; latency: number; download: number; upload: number }> = {
  offline: { offline: true, latency: 0, download: 0, upload: 0 },
  'slow-3g': { offline: false, latency: 400, download: (500 * 1024) / 8, upload: (500 * 1024) / 8 },
  'fast-3g': { offline: false, latency: 150, download: (1.5 * 1024 * 1024) / 8, upload: (750 * 1024) / 8 },
};

export async function applyNetworkProfile(
  page: Page,
  profile: NetworkProfile
): Promise<void> {
  const session = await page.context().newCDPSession(page);
  if (profile === 'none') {
    await session.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });
    return;
  }
  const p = PROFILES[profile];
  await session.send('Network.emulateNetworkConditions', {
    offline: p.offline,
    latency: p.latency,
    downloadThroughput: p.download,
    uploadThroughput: p.upload,
  });
}
