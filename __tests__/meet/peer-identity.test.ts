import { describe, expect, it } from 'vitest';
import { shouldInitiateOffer, userIdFromPeerId } from '@/hooks/useWebRTC';

describe('userIdFromPeerId', () => {
    it('recovers the account id from a session peer id', () => {
        expect(userIdFromPeerId('8a1f-uuid#k3j9zq1p')).toBe('8a1f-uuid');
    });

    it('leaves plain ids untouched for older clients', () => {
        expect(userIdFromPeerId('8a1f-uuid')).toBe('8a1f-uuid');
        expect(userIdFromPeerId('guest-1726000000-abc')).toBe('guest-1726000000-abc');
    });
});

describe('shouldInitiateOffer', () => {
    it('elects exactly one offerer for a pair', () => {
        const a = 'user-a#aaa111';
        const b = 'user-b#bbb222';
        expect([shouldInitiateOffer(a, b), shouldInitiateOffer(b, a)].filter(Boolean)).toHaveLength(1);
    });

    it('still elects one offerer when both devices share an account', () => {
        const phone = 'same-user#aaa111';
        const laptop = 'same-user#bbb222';
        expect(phone).not.toBe(laptop);
        expect([shouldInitiateOffer(phone, laptop), shouldInitiateOffer(laptop, phone)].filter(Boolean)).toHaveLength(1);
    });

    it('never offers to itself or to an unidentified peer', () => {
        expect(shouldInitiateOffer('user-a#aaa111', 'user-a#aaa111')).toBe(false);
        expect(shouldInitiateOffer('', 'user-b#bbb222')).toBe(false);
        expect(shouldInitiateOffer('user-a#aaa111', '')).toBe(false);
    });
});
