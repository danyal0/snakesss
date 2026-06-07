import { chromium } from '@playwright/test';

const FAKE_MIC_SCRIPT = () => {
  navigator.mediaDevices.getUserMedia = async (constraints) => {
    if (!constraints?.audio) throw new Error('audio required');
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const dest = ctx.createMediaStreamDestination();
    osc.connect(dest);
    osc.start();
    return dest.stream;
  };
};

const baseURL = 'http://localhost:5173';

const hostContext = await chromium.launch().then((b) => b.newContext());
const guestContext = await chromium.launch().then((b) => b.newContext());
await hostContext.grantPermissions(['microphone']);
await guestContext.grantPermissions(['microphone']);
await hostContext.addInitScript(FAKE_MIC_SCRIPT);
await guestContext.addInitScript(FAKE_MIC_SCRIPT);

const hostPage = await hostContext.newPage();
const guestPage = await guestContext.newPage();

await hostPage.goto(baseURL);
await hostPage.getByTestId('home-screen').waitFor();
await hostPage.getByTestId('btn-create-room').click();
await hostPage.getByTestId('input-username').fill('VoiceHost');
await hostPage.getByTestId('btn-submit-room').click();
await hostPage.getByTestId('lobby-screen').waitFor({ timeout: 20_000 });
const roomId = await hostPage.getByTestId('room-code').innerText();

await guestPage.goto(baseURL);
await guestPage.getByTestId('home-screen').waitFor();
await guestPage.getByTestId('btn-join-room').click();
await guestPage.getByTestId('join-room-form').waitFor({ timeout: 15_000 });
await guestPage.getByTestId('input-username').fill('VoiceGuest');
await guestPage.getByTestId('input-room-code').fill(roomId);
await guestPage.getByTestId('btn-submit-room').click();
await guestPage.getByTestId('lobby-screen').waitFor({ timeout: 20_000 });

await hostPage.getByTestId('lobby-tab-players').click();
await guestPage.getByTestId('lobby-tab-players').click();
await hostPage.getByTestId('btn-voice-mic').click();
await guestPage.getByTestId('btn-voice-mic').click();

const deadline = Date.now() + 30_000;
let ok = false;
while (Date.now() < deadline) {
  const hostVoice = await hostPage.evaluate(() => window.__VOICE_DEBUG__?.getState());
  const guestVoice = await guestPage.evaluate(() => window.__VOICE_DEBUG__?.getState());
  console.log('host', JSON.stringify(hostVoice));
  console.log('guest', JSON.stringify(guestVoice));
  if (hostVoice?.peerCount === 1 && guestVoice?.peerCount === 1) {
    const h = hostVoice.peers[0];
    const g = guestVoice.peers[0];
    if (
      h?.hasRemoteTrack &&
      g?.hasRemoteTrack &&
      (h.connectionState === 'connected' || h.iceState === 'connected') &&
      (g.connectionState === 'connected' || g.iceState === 'connected')
    ) {
      ok = true;
      break;
    }
  }
  await new Promise((r) => setTimeout(r, 1000));
}

await hostContext.close();
await guestContext.close();

if (!ok) {
  console.error('Voice connection test FAILED');
  process.exit(1);
}
console.log('Voice connection test PASSED');
process.exit(0);
