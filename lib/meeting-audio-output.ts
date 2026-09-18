/** Pick loudspeaker vs earpiece for meeting playback. */

export type MediaDeviceLike = {
    deviceId: string;
    kind: string;
    label: string;
};

export type PickedAudioOutput = {
    deviceId: string;
    label: string;
};

function labelOf(device: MediaDeviceLike) {
    return (device.label || '').toLowerCase();
}

function isEarpieceLike(label: string) {
    if (/speaker/.test(label)) return false;
    return /earpiece|ear piece|receiver|handset|telephony|communications?|\bphone\b/.test(label);
}

function isHeadphoneLike(label: string) {
    return /headphone|headset|bluetooth|airpod|hands-?free/.test(label);
}

function isSpeakerLike(label: string) {
    return /speaker|loudspeaker|loud speaker/.test(label);
}

export function scoreSpeakerOutput(device: MediaDeviceLike) {
    const label = labelOf(device);
    if (isEarpieceLike(label)) return 0;
    if (isHeadphoneLike(label)) return 1;
    if (device.deviceId === 'communications') return 0;
    if (isSpeakerLike(label)) return 4;
    if (device.deviceId === 'default' || label.includes('default')) return 3;
    return 2;
}

export function scoreEarpieceOutput(device: MediaDeviceLike) {
    const label = labelOf(device);
    if (isSpeakerLike(label)) return 0;
    if (isEarpieceLike(label) || device.deviceId === 'communications') return 4;
    if (device.deviceId === 'default' || label.includes('default')) return 2;
    return 1;
}

function pickByScore(devices: MediaDeviceLike[], score: (d: MediaDeviceLike) => number): PickedAudioOutput | null {
    const outputs = devices.filter((d) => d.kind === 'audiooutput');
    if (!outputs.length) return null;
    const ranked = [...outputs].sort((a, b) => {
        const diff = score(b) - score(a);
        if (diff !== 0) return diff;
        return a.label.localeCompare(b.label);
    });
    const best = ranked[0];
    return { deviceId: best.deviceId, label: best.label || 'Speaker' };
}

export function pickSpeakerOutputDevice(devices: MediaDeviceLike[]): PickedAudioOutput | null {
    return pickByScore(devices, scoreSpeakerOutput);
}

export function pickEarpieceOutputDevice(devices: MediaDeviceLike[]): PickedAudioOutput | null {
    return pickByScore(devices, scoreEarpieceOutput);
}

type Sinkable = HTMLMediaElement & { setSinkId?: (id: string) => Promise<void> };

export async function applyAudioOutputToElement(el: HTMLMediaElement, deviceId: string | null | undefined) {
    if (!deviceId) return false;
    const sinkable = el as Sinkable;
    if (typeof sinkable.setSinkId !== 'function') return false;
    try {
        await sinkable.setSinkId(deviceId);
        return true;
    } catch {
        return false;
    }
}

/** iOS WebKit: getUserMedia puts audio on the earpiece unless the session type is playback. */
export function applyMeetingAudioSession(speakerOn: boolean) {
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (!session) return false;
    try {
        session.type = speakerOn ? 'playback' : 'play-and-record';
        return true;
    } catch {
        return false;
    }
}

export async function resolvePreferredAudioOutput(speakerOn: boolean): Promise<PickedAudioOutput | null> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return null;
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return speakerOn ? pickSpeakerOutputDevice(devices) : pickEarpieceOutputDevice(devices);
    } catch {
        return null;
    }
}

export async function playSpeakerTestTone(deviceId?: string | null) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return false;
    const ctx = new AC();
    try {
        const sinkable = ctx as AudioContext & { setSinkId?: (id: string) => Promise<void> };
        if (deviceId && typeof sinkable.setSinkId === 'function') {
            try {
                await sinkable.setSinkId(deviceId);
            } catch {
                /* keep default output */
            }
        }
        if (ctx.state === 'suspended') await ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.38);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
        await new Promise((resolve) => window.setTimeout(resolve, 420));
        return true;
    } catch {
        return false;
    } finally {
        void ctx.close();
    }
}

export function unlockRemoteMediaElements() {
    document.querySelectorAll('audio[data-meeting-remote="1"], video[data-meeting-remote="1"]').forEach((node) => {
        const el = node as HTMLMediaElement;
        if (el.tagName === 'AUDIO') {
            el.muted = false;
            el.volume = 1;
        }
        void el.play().catch(() => undefined);
    });
}
