import { applyMeetingAudioSession } from '@/lib/meeting-audio-output';

/** Prefer the Mac's own camera/mic so Continuity Camera / iPhone does not steal getUserMedia. */

export type MediaDeviceLike = {
    deviceId: string;
    kind: string;
    label: string;
};

export function isAppleWebKitBrowser(userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent) {
    if (!userAgent) return false;
    const ua = userAgent;
    if (/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua)) return true;
    if (/Chrome|Chromium|Edg\//i.test(ua) && !/Safari/i.test(ua)) return false;
    if (/Chrome|Chromium|Edg\//i.test(ua)) return false;
    return /Safari/i.test(ua) || /iP(hone|ad|od)/i.test(ua);
}

export function isMobileMeetingClient(userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent) {
    return /iPhone|iPad|iPod|Android/i.test(userAgent);
}

function labelOf(device: MediaDeviceLike) {
    return (device.label || '').toLowerCase();
}

export function isPhoneOrContinuityCamera(label: string) {
    const l = (label || '').toLowerCase();
    return /iphone|ipad|continuity|desk view|sidecar/.test(l);
}

export function isVirtualCamera(label: string) {
    const l = (label || '').toLowerCase();
    if (isPhoneOrContinuityCamera(l)) return true;
    return /obs|virtual|camo|snap camera|epoccam|iriun|mmhmm|streamlabs|ndisource/.test(l);
}

export function isBuiltInMacCamera(label: string) {
    const l = (label || '').toLowerCase();
    return /facetime|built-?in|macbook|imac|studio display camera|hd camera|integrated/.test(l)
        && !isPhoneOrContinuityCamera(l);
}

export function isPhoneOrContinuityMic(label: string) {
    const l = (label || '').toLowerCase();
    return /iphone|ipad|continuity/.test(l);
}

export function isBuiltInMacMic(label: string) {
    const l = (label || '').toLowerCase();
    return /macbook|imac|built-?in|internal microphone|mac mini/.test(l) && !isPhoneOrContinuityMic(l);
}

export function scoreVideoInput(device: MediaDeviceLike) {
    const label = labelOf(device);
    if (!device.deviceId) return -1;
    if (isPhoneOrContinuityCamera(label)) return 0;
    if (isVirtualCamera(label)) return 1;
    if (isBuiltInMacCamera(label)) return 6;
    if (device.deviceId === 'default') return 3;
    return 4;
}

export function scoreAudioInput(device: MediaDeviceLike) {
    const label = labelOf(device);
    if (!device.deviceId) return -1;
    if (isPhoneOrContinuityMic(label)) return 0;
    if (isBuiltInMacMic(label)) return 6;
    if (device.deviceId === 'default' || device.deviceId === 'communications') return 3;
    return 4;
}

function pickByScore(devices: MediaDeviceLike[], kind: string, score: (d: MediaDeviceLike) => number): MediaDeviceLike | null {
    const list = devices.filter((d) => d.kind === kind && d.deviceId);
    if (!list.length) return null;
    const ranked = [...list].sort((a, b) => {
        const diff = score(b) - score(a);
        if (diff !== 0) return diff;
        return (a.label || '').localeCompare(b.label || '');
    });
    return ranked[0] || null;
}

export function pickPreferredVideoInput(devices: MediaDeviceLike[]) {
    return pickByScore(devices, 'videoinput', scoreVideoInput);
}

export function pickPreferredAudioInput(devices: MediaDeviceLike[]) {
    return pickByScore(devices, 'audioinput', scoreAudioInput);
}

export function shouldReplaceVideoDevice(currentLabel: string, preferred: MediaDeviceLike | null) {
    if (!preferred) return false;
    if (isPhoneOrContinuityCamera(currentLabel) || isVirtualCamera(currentLabel)) return true;
    if (isBuiltInMacCamera(preferred.label) && !isBuiltInMacCamera(currentLabel) && preferred.deviceId !== 'default') {
        return true;
    }
    return false;
}

export function shouldReplaceAudioDevice(currentLabel: string, preferred: MediaDeviceLike | null) {
    if (!preferred) return false;
    if (isPhoneOrContinuityMic(currentLabel)) return true;
    if (isBuiltInMacMic(preferred.label) && isPhoneOrContinuityMic(currentLabel)) return true;
    return false;
}

export function videoOnlyStream(stream: MediaStream | null | undefined, extra?: MediaStreamTrack | null) {
    const tracks = extra && extra.kind === 'video' && extra.readyState === 'live'
        ? [extra]
        : (stream?.getVideoTracks().filter((t) => t.readyState === 'live') ?? []);
    return tracks.length ? new MediaStream(tracks) : null;
}

function markMeetingTracks(stream: MediaStream) {
    stream.getAudioTracks().forEach((track) => {
        try {
            if ('contentHint' in track) track.contentHint = 'speech';
        } catch {
            /* ignore */
        }
    });
    stream.getVideoTracks().forEach((track) => {
        try {
            if ('contentHint' in track) track.contentHint = 'motion';
        } catch {
            /* ignore */
        }
    });
    return stream;
}

async function gum(constraints: MediaStreamConstraints) {
    return navigator.mediaDevices.getUserMedia(constraints);
}

async function listDevices(): Promise<MediaDeviceLike[]> {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.map((d) => ({ deviceId: d.deviceId, kind: d.kind, label: d.label || '' }));
    } catch {
        return [];
    }
}

function replaceTrackOnStream(stream: MediaStream, next: MediaStreamTrack) {
    const kind = next.kind;
    stream.getTracks().filter((t) => t.kind === kind).forEach((old) => {
        stream.removeTrack(old);
        try { old.stop(); } catch { /* ignore */ }
    });
    stream.addTrack(next);
}

export function macMediaPermissionHint() {
    return 'On a Mac, allow Camera and Microphone for this browser in System Settings → Privacy & Security, then reload.';
}

/** Open camera + mic, preferring the laptop's own devices on macOS. */
export async function acquireMeetingMedia(): Promise<MediaStream | null> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return null;

    const mobile = isMobileMeetingClient();
    const attempts: MediaStreamConstraints[] = mobile
        ? [
            {
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
                video: { facingMode: 'user' },
            },
            { audio: true, video: true },
            { audio: true, video: false },
            { audio: false, video: true },
        ]
        : [
            { audio: true, video: true },
            {
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
                video: true,
            },
            { audio: true, video: false },
            { audio: false, video: true },
        ];

    let stream: MediaStream | null = null;
    for (const constraints of attempts) {
        try {
            stream = await gum(constraints);
            break;
        } catch {
            /* try a simpler constraint set */
        }
    }
    if (!stream) return null;
    applyMeetingAudioSession(true);

    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
        await audioTrack.applyConstraints({
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
        }).catch(() => undefined);
    }

    const devices = await listDevices();
    const wantVideo = pickPreferredVideoInput(devices);
    const wantAudio = pickPreferredAudioInput(devices);
    const currentVideo = stream.getVideoTracks()[0];
    const currentAudio = stream.getAudioTracks()[0];

    if (wantVideo && currentVideo && shouldReplaceVideoDevice(currentVideo.label, wantVideo) && wantVideo.deviceId) {
        try {
            const next = await gum({ video: { deviceId: { exact: wantVideo.deviceId } }, audio: false });
            const track = next.getVideoTracks()[0];
            if (track) replaceTrackOnStream(stream, track);
            next.getTracks().forEach((t) => {
                if (t !== track) {
                    try { t.stop(); } catch { /* ignore */ }
                }
            });
        } catch {
            /* keep the first camera */
        }
    }

    if (wantAudio && currentAudio && shouldReplaceAudioDevice(currentAudio.label, wantAudio) && wantAudio.deviceId) {
        try {
            const next = await gum({ audio: { deviceId: { exact: wantAudio.deviceId } }, video: false });
            const track = next.getAudioTracks()[0];
            if (track) replaceTrackOnStream(stream, track);
            next.getTracks().forEach((t) => {
                if (t !== track) {
                    try { t.stop(); } catch { /* ignore */ }
                }
            });
        } catch {
            /* keep the first mic */
        }
    }

    return markMeetingTracks(stream);
}

export async function acquireCameraTrack(): Promise<MediaStreamTrack | null> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return null;
    const devices = await listDevices();
    const preferred = pickPreferredVideoInput(devices);
    const tries: MediaStreamConstraints[] = [];
    if (preferred?.deviceId && !isPhoneOrContinuityCamera(preferred.label)) {
        tries.push({ video: { deviceId: { exact: preferred.deviceId } }, audio: false });
    }
    if (isMobileMeetingClient()) {
        tries.push({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    }
    tries.push({ video: true, audio: false });
    for (const constraints of tries) {
        try {
            const camOnly = await gum(constraints);
            const track = camOnly.getVideoTracks()[0] ?? null;
            camOnly.getTracks().forEach((t) => {
                if (t !== track) {
                    try { t.stop(); } catch { /* ignore */ }
                }
            });
            if (track) {
                markMeetingTracks(new MediaStream([track]));
                return track;
            }
        } catch {
            /* next */
        }
    }
    return null;
}
