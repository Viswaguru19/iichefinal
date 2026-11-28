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

export function videoOnlyStream(
    stream: MediaStream | null | undefined,
    extra?: MediaStreamTrack | null,
    opts?: { enabledOnly?: boolean },
) {
    const enabledOnly = opts?.enabledOnly === true;
    const usable = (t: MediaStreamTrack) =>
        t.kind === 'video' && t.readyState === 'live' && (!enabledOnly || t.enabled);
    const tracks = extra && usable(extra)
        ? [extra]
        : (stream?.getVideoTracks().filter(usable) ?? []);
    return tracks.length ? new MediaStream(tracks) : null;
}

export function videoPreviewTrackKey(
    stream: MediaStream | null | undefined,
    extra?: MediaStreamTrack | null,
    opts?: { enabledOnly?: boolean },
) {
    return videoOnlyStream(stream, extra, opts)?.getVideoTracks().map((t) => t.id).join('|') ?? '';
}

function attachedPreviewTrackKey(el: HTMLVideoElement) {
    const src = el.srcObject;
    if (!(src instanceof MediaStream)) return '';
    return src.getVideoTracks().map((t) => t.id).join('|');
}

/** Attach camera tracks to the local preview without tearing down a stream that is already showing them. */
export function bindLocalPreviewVideo(
    el: HTMLVideoElement | null,
    stream: MediaStream | null | undefined,
    extra?: MediaStreamTrack | null,
) {
    if (!el) return false;
    el.muted = true;
    el.playsInline = true;
    el.autoplay = true;
    el.setAttribute('playsinline', 'true');
    el.setAttribute('webkit-playsinline', 'true');
    const videoOnly = videoOnlyStream(stream, extra, { enabledOnly: true });
    if (!videoOnly) {
        if (el.srcObject) el.srcObject = null;
        return false;
    }
    const nextKey = videoPreviewTrackKey(stream, extra, { enabledOnly: true });
    if (attachedPreviewTrackKey(el) === nextKey) {
        void el.play().catch(() => undefined);
        return true;
    }
    el.srcObject = videoOnly;
    const play = () => void el.play().catch(() => undefined);
    el.onloadedmetadata = play;
    play();
    return true;
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

function stopOtherTracks(stream: MediaStream | null, keep?: MediaStreamTrack | null) {
    stream?.getTracks().forEach((track) => {
        if (track === keep) return;
        try { track.stop(); } catch { /* ignore */ }
    });
}

function speechAudio(deviceId?: string): MediaTrackConstraints {
    const audio: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
    };
    if (deviceId && deviceId !== 'default' && deviceId !== 'communications') {
        audio.deviceId = { exact: deviceId };
    }
    return audio;
}

/** Open the microphone by itself. A failed switch back to the Mac mic must not leave the first track ended. */
export async function acquireMicrophoneTrack(): Promise<MediaStreamTrack | null> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return null;

    let probe: MediaStream | null = null;
    for (const constraints of [
        { audio: speechAudio(), video: false },
        { audio: true, video: false },
    ] as MediaStreamConstraints[]) {
        try {
            probe = await gum(constraints);
            break;
        } catch {
            /* Safari/Chrome on Mac reject some constraint sets */
        }
    }
    if (!probe) return null;

    const current = probe.getAudioTracks()[0] || null;
    if (!current) {
        stopOtherTracks(probe);
        return null;
    }

    const devices = await listDevices();
    const preferred = pickPreferredAudioInput(devices);
    const currentId = typeof current.getSettings === 'function' ? current.getSettings().deviceId || '' : '';
    const listedLabel = devices.find((d) => d.kind === 'audioinput' && d.deviceId === currentId)?.label || '';
    const swap = Boolean(
        preferred
        && shouldReplaceAudioDevice(current.label || listedLabel, preferred)
        && preferred.deviceId
        && preferred.deviceId !== 'default'
        && preferred.deviceId !== 'communications'
        && preferred.deviceId !== currentId,
    );
    if (!swap) {
        current.enabled = true;
        return current;
    }

    stopOtherTracks(probe);
    try {
        const next = await gum({ audio: speechAudio(preferred!.deviceId), video: false });
        const track = next.getAudioTracks()[0] || null;
        stopOtherTracks(next, track);
        if (track && track.readyState === 'live') {
            track.enabled = true;
            return track;
        }
    } catch {
        /* exact Mac mic was busy or rejected */
    }

    try {
        const again = await gum({ audio: true, video: false });
        const track = again.getAudioTracks()[0] || null;
        stopOtherTracks(again, track);
        if (track) track.enabled = true;
        return track;
    } catch {
        return null;
    }
}

async function listDevices(): Promise<MediaDeviceLike[]> {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.map((d) => ({ deviceId: d.deviceId, kind: d.kind, label: d.label || '' }));
    } catch {
        return [];
    }
}

export function macMediaPermissionHint() {
    return 'On a Mac, allow Camera and Microphone for this browser in System Settings → Privacy & Security, then reload.';
}

/** Open camera + mic. On a Mac the mic is opened alone so a camera or device swap cannot end it. */
export async function acquireMeetingMedia(): Promise<MediaStream | null> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return null;

    if (!isMobileMeetingClient()) {
        let audio = await acquireMicrophoneTrack();
        const video = await acquireCameraTrack();
        if (audio && audio.readyState !== 'live') {
            try { audio.stop(); } catch { /* ignore */ }
            audio = await acquireMicrophoneTrack();
        }
        const tracks = [audio, video].filter((track): track is MediaStreamTrack => !!track && track.readyState === 'live');
        if (!tracks.length) return null;
        applyMeetingAudioSession(true);
        return markMeetingTracks(new MediaStream(tracks));
    }

    const attempts: MediaStreamConstraints[] = [
        {
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            video: { facingMode: 'user' },
        },
        { audio: true, video: true },
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
