/**
 * ICE server configuration for meeting calls.
 *
 * STUN alone only works when at least one side is reachable directly. Mobile
 * carriers put phones behind carrier-grade NAT, so a TURN relay is required or
 * the call connects to nothing and both sides see silence and a blank tile.
 */

export type IceServerConfig = {
    urls: string | string[];
    username?: string;
    credential?: string;
};

export const STUN_SERVERS: IceServerConfig[] = [
    {
        urls: [
            'stun:stun.l.google.com:19302',
            'stun:stun1.l.google.com:19302',
            'stun:stun2.l.google.com:19302',
        ],
    },
    { urls: 'stun:stun.cloudflare.com:3478' },
];

function urlList(server: IceServerConfig): string[] {
    return Array.isArray(server.urls) ? server.urls : [server.urls];
}

/** True when at least one entry is a usable, credentialed TURN relay. */
export function hasUsableRelay(servers: IceServerConfig[]) {
    return servers.some((server) => {
        const isTurn = urlList(server).some((url) => url.startsWith('turn:') || url.startsWith('turns:'));
        return isTurn && Boolean(server.username) && Boolean(server.credential);
    });
}

export function parseStaticTurn(input: {
    urls?: string | null;
    username?: string | null;
    credential?: string | null;
}): IceServerConfig | null {
    const urls = String(input.urls ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    const username = String(input.username ?? '').trim();
    const credential = String(input.credential ?? '').trim();
    if (!urls.length || !username || !credential) return null;
    return { urls, username, credential };
}

/** Cloudflare returns either a single object or an array under `iceServers`. */
export function normalizeIceServers(payload: unknown): IceServerConfig[] {
    const root = (payload as { iceServers?: unknown })?.iceServers ?? payload;
    const entries = Array.isArray(root) ? root : [root];
    const out: IceServerConfig[] = [];
    for (const entry of entries) {
        const candidate = entry as IceServerConfig | null;
        if (!candidate?.urls) continue;
        const urls = urlList(candidate).filter((url) => typeof url === 'string' && url.length > 0);
        if (!urls.length) continue;
        out.push({
            urls,
            ...(candidate.username ? { username: candidate.username } : {}),
            ...(candidate.credential ? { credential: candidate.credential } : {}),
        });
    }
    return out;
}

export function buildIceServers(relay: IceServerConfig[] | null | undefined): IceServerConfig[] {
    return [...STUN_SERVERS, ...(relay ?? [])];
}
