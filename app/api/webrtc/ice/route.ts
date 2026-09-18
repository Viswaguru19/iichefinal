import { NextResponse } from 'next/server';
import {
    buildIceServers,
    hasUsableRelay,
    normalizeIceServers,
    parseStaticTurn,
    type IceServerConfig,
} from '@/lib/ice-servers';

/**
 * Serves ICE servers to meeting clients so TURN credentials can be rotated
 * server-side instead of being baked into the browser bundle.
 */

/** Credentials are time limited, so this must never be prerendered or cached. */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CREDENTIAL_TTL_SECONDS = 12 * 60 * 60;
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

let cachedRelay: { servers: IceServerConfig[]; expiresAt: number } | null = null;

async function cloudflareRelay(): Promise<IceServerConfig[] | null> {
    const keyId = process.env.CLOUDFLARE_TURN_KEY_ID;
    const token = process.env.CLOUDFLARE_TURN_API_TOKEN;
    if (!keyId || !token) return null;

    if (cachedRelay && cachedRelay.expiresAt - REFRESH_MARGIN_MS > Date.now()) {
        return cachedRelay.servers;
    }

    try {
        const res = await fetch(
            `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`,
            {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ ttl: CREDENTIAL_TTL_SECONDS }),
                cache: 'no-store',
            },
        );
        if (!res.ok) {
            console.error('Cloudflare TURN credential request failed', res.status);
            return null;
        }
        const servers = normalizeIceServers(await res.json());
        if (!hasUsableRelay(servers)) return null;
        cachedRelay = { servers, expiresAt: Date.now() + CREDENTIAL_TTL_SECONDS * 1000 };
        return servers;
    } catch (error) {
        console.error('Cloudflare TURN credential request error', error);
        return null;
    }
}

function staticRelay(): IceServerConfig[] | null {
    const fromServerEnv = parseStaticTurn({
        urls: process.env.TURN_URLS,
        username: process.env.TURN_USERNAME,
        credential: process.env.TURN_CREDENTIAL,
    });
    if (fromServerEnv) return [fromServerEnv];

    const fromPublicEnv = parseStaticTurn({
        urls: process.env.NEXT_PUBLIC_TURN_URLS,
        username: process.env.NEXT_PUBLIC_TURN_USERNAME,
        credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
    });
    return fromPublicEnv ? [fromPublicEnv] : null;
}

export async function GET() {
    const relay = (await cloudflareRelay()) ?? staticRelay();
    const iceServers = buildIceServers(relay);
    return NextResponse.json(
        { iceServers, hasRelay: hasUsableRelay(iceServers) },
        { headers: { 'Cache-Control': 'no-store' } },
    );
}
