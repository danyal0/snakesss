import type { FingerprintSignals, IdentityClaims } from '@snakesss/shared-types';

const STORAGE_KEY = 'snakesss_fp_salt';

function getOrCreateSalt(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const salt = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, salt);
    return salt;
  } catch {
    return 'ephemeral';
  }
}

async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hashValue(value: string): Promise<string> {
  const salt = getOrCreateSalt();
  return sha256(`${salt}:${value}`);
}

function getWebGLVendor(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl');
    if (!gl || !(gl instanceof WebGLRenderingContext)) return 'none';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (!ext) return 'webgl';
    return gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) as string;
  } catch {
    return 'none';
  }
}

async function getAudioFingerprintHash(): Promise<string> {
  try {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const analyser = ctx.createAnalyser();
    const gain = ctx.createGain();
    gain.gain.value = 0;
    oscillator.connect(analyser);
    analyser.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(0);
    const data = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatFrequencyData(data);
    oscillator.stop();
    await ctx.close();
    const sample = data.slice(0, 32).join(',');
    return hashValue(sample);
  } catch {
    return hashValue('no-audio');
  }
}

let cachedSignals: FingerprintSignals | null = null;

export async function collectFingerprintSignals(): Promise<FingerprintSignals> {
  if (cachedSignals) return cachedSignals;

  const webglVendor = getWebGLVendor();
  cachedSignals = {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    screenResolution: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    webglVendorHash: await hashValue(webglVendor),
    audioFingerprintHash: await getAudioFingerprintHash(),
  };
  return cachedSignals;
}

let joinStartedAt: number | null = null;

export function markJoinStarted(): void {
  joinStartedAt = Date.now();
}

export function getJoinToActionDelayMs(): number | undefined {
  if (joinStartedAt === null) return undefined;
  return Date.now() - joinStartedAt;
}

export async function buildIdentityClaims(): Promise<IdentityClaims> {
  const fingerprint = await collectFingerprintSignals();
  const delay = getJoinToActionDelayMs();
  return {
    fingerprint,
    behavioral: delay !== undefined ? { joinToActionDelayMs: delay } : undefined,
    clientTimestamp: Date.now(),
  };
}
