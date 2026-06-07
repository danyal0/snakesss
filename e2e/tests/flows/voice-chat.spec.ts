import { test, expect } from '@playwright/test';
import { HomePage } from '../../pages/home.page';
import { prepareTestPage, settleTestHarness } from '../../utils/reset';

const FAKE_MIC_SCRIPT = () => {
  const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async (constraints) => {
    if (!constraints?.audio) return orig(constraints);
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const dest = ctx.createMediaStreamDestination();
    osc.connect(dest);
    osc.start();
    return dest.stream;
  };
};

test.describe('Voice chat', () => {
  test('two players establish WebRTC voice connection in lobby', async ({ browser }) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    await hostContext.grantPermissions(['microphone']);
    await guestContext.grantPermissions(['microphone']);
    await hostContext.addInitScript(FAKE_MIC_SCRIPT);
    await guestContext.addInitScript(FAKE_MIC_SCRIPT);

    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();
    await prepareTestPage(hostPage);
    await prepareTestPage(guestPage);

    const home = new HomePage(hostPage);
    await home.goto();
    const roomId = await home.openCreateRoom('VoiceHost');

    const guestHome = new HomePage(guestPage);
    await guestHome.goto();
    await guestHome.openJoinRoom(roomId, 'VoiceGuest');
    await guestPage.getByTestId('lobby-screen').waitFor({ timeout: 20_000 });

    await hostPage.getByTestId('lobby-tab-players').click();
    await guestPage.getByTestId('lobby-tab-players').click();

    await hostPage.getByTestId('btn-voice-mic').click();
    await guestPage.getByTestId('btn-voice-mic').click();

    await expect.poll(
      async () => {
        const hostVoice = await hostPage.evaluate(() => window.__VOICE_DEBUG__?.getState());
        const guestVoice = await guestPage.evaluate(() => window.__VOICE_DEBUG__?.getState());
        if (!hostVoice || !guestVoice) return false;
        if (hostVoice.peerCount !== 1 || guestVoice.peerCount !== 1) return false;
        const hostPeer = hostVoice.peers[0];
        const guestPeer = guestVoice.peers[0];
        return (
          hostPeer?.hasRemoteTrack === true &&
          guestPeer?.hasRemoteTrack === true &&
          (hostPeer.connectionState === 'connected' || hostPeer.iceState === 'connected') &&
          (guestPeer.connectionState === 'connected' || guestPeer.iceState === 'connected')
        );
      },
      { timeout: 30_000, intervals: [500, 1000, 2000] }
    ).toBe(true);

    await hostContext.close();
    await guestContext.close();
  });
});
