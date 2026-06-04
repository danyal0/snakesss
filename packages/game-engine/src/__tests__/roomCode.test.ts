import { describe, it, expect } from 'vitest';
import { generateRoomCode, isValidRoomCode } from '../utils';
import { GameEngine } from '../GameEngine';
import type { AvatarEmoji } from '@snakesss/shared-types';

describe('room codes', () => {
  it('generates 4-character codes', () => {
    const code = generateRoomCode();
    expect(code).toHaveLength(4);
    expect(isValidRoomCode(code)).toBe(true);
  });

  it('uses preferred room id when valid and available', () => {
    const engine = new GameEngine({
      managerId: 'm1',
      managerName: 'Host',
      managerAvatar: '🦊' as AvatarEmoji,
      preferredRoomId: 'XYM2',
    });
    expect(engine.getRoomId()).toBe('XYM2');
  });
});
