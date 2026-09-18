import { describe, expect, it } from 'vitest';
import {
    buildIceServers,
    hasUsableRelay,
    normalizeIceServers,
    parseStaticTurn,
    STUN_SERVERS,
} from '@/lib/ice-servers';

describe('hasUsableRelay', () => {
    it('does not count STUN-only configuration as a relay', () => {
        expect(hasUsableRelay(STUN_SERVERS)).toBe(false);
    });

    it('rejects a TURN entry with no credentials', () => {
        expect(hasUsableRelay([{ urls: 'turn:relay.example.com:3478' }])).toBe(false);
    });

    it('accepts a credentialed TURN entry', () => {
        expect(
            hasUsableRelay([{ urls: ['turns:relay.example.com:5349'], username: 'u', credential: 'c' }]),
        ).toBe(true);
    });
});

describe('parseStaticTurn', () => {
    it('splits a comma separated url list', () => {
        expect(
            parseStaticTurn({
                urls: 'turn:relay.example.com:3478, turns:relay.example.com:5349',
                username: 'u',
                credential: 'c',
            }),
        ).toEqual({
            urls: ['turn:relay.example.com:3478', 'turns:relay.example.com:5349'],
            username: 'u',
            credential: 'c',
        });
    });

    it('returns null when any part is missing', () => {
        expect(parseStaticTurn({ urls: 'turn:relay.example.com:3478', username: 'u' })).toBeNull();
        expect(parseStaticTurn({ username: 'u', credential: 'c' })).toBeNull();
        expect(parseStaticTurn({})).toBeNull();
    });
});

describe('normalizeIceServers', () => {
    it('accepts the single-object shape Cloudflare returns', () => {
        const servers = normalizeIceServers({
            iceServers: { urls: ['turn:turn.cloudflare.com:3478'], username: 'u', credential: 'c' },
        });
        expect(servers).toHaveLength(1);
        expect(hasUsableRelay(servers)).toBe(true);
    });

    it('accepts an array of servers', () => {
        const servers = normalizeIceServers({
            iceServers: [{ urls: 'stun:stun.example.com:3478' }, { urls: 'turn:t.example.com:3478', username: 'u', credential: 'c' }],
        });
        expect(servers).toHaveLength(2);
        expect(hasUsableRelay(servers)).toBe(true);
    });

    it('drops malformed entries instead of throwing', () => {
        expect(normalizeIceServers({ iceServers: [{}, { urls: '' }, null] })).toEqual([]);
        expect(normalizeIceServers(null)).toEqual([]);
        expect(normalizeIceServers({})).toEqual([]);
    });
});

describe('buildIceServers', () => {
    it('always keeps STUN and appends the relay', () => {
        const relay = [{ urls: 'turn:t.example.com:3478', username: 'u', credential: 'c' }];
        const servers = buildIceServers(relay);
        expect(servers).toHaveLength(STUN_SERVERS.length + 1);
        expect(hasUsableRelay(servers)).toBe(true);
    });

    it('falls back to STUN only when no relay is configured', () => {
        expect(buildIceServers(null)).toEqual(STUN_SERVERS);
    });
});
