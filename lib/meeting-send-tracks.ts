/** Prefer a live screen-share track so late joiners still see it instead of the camera. */
export function pickSendVideoTrack(
    local: MediaStream | null | undefined,
    outbound: MediaStreamTrack | null | undefined,
): MediaStreamTrack | null {
    if (outbound && outbound.kind === 'video' && outbound.readyState === 'live') return outbound;
    return local?.getVideoTracks().find((t) => t.readyState === 'live') ?? null;
}

export function pickSendAudioTrack(local: MediaStream | null | undefined): MediaStreamTrack | null {
    return local?.getAudioTracks().find((t) => t.readyState === 'live') ?? null;
}
