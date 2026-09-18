import { describe, expect, it } from 'vitest';
import {
    pickEarpieceOutputDevice,
    pickSpeakerOutputDevice,
    scoreSpeakerOutput,
} from '@/lib/meeting-audio-output';

describe('meeting audio output', () => {
    it('prefers the loudspeaker over earpiece and headphones', () => {
        const picked = pickSpeakerOutputDevice([
            { deviceId: 'ear', kind: 'audiooutput', label: 'Phone Earpiece' },
            { deviceId: 'bt', kind: 'audiooutput', label: 'AirPods' },
            { deviceId: 'sp', kind: 'audiooutput', label: 'Speaker' },
        ]);
        expect(picked).toEqual({ deviceId: 'sp', label: 'Speaker' });
    });

    it('treats speakerphone as the main speaker, not the earpiece', () => {
        const picked = pickSpeakerOutputDevice([
            { deviceId: 'ear', kind: 'audiooutput', label: 'Phone' },
            { deviceId: 'sp', kind: 'audiooutput', label: 'Speakerphone' },
        ]);
        expect(picked?.deviceId).toBe('sp');
    });

    it('uses the default output when no device is labeled speaker', () => {
        const picked = pickSpeakerOutputDevice([
            { deviceId: 'communications', kind: 'audiooutput', label: 'Communications' },
            { deviceId: 'default', kind: 'audiooutput', label: 'Default' },
        ]);
        expect(picked?.deviceId).toBe('default');
    });

    it('ignores microphones when choosing speaker output', () => {
        const picked = pickSpeakerOutputDevice([
            { deviceId: 'mic', kind: 'audioinput', label: 'Built-in Microphone' },
            { deviceId: 'out', kind: 'audiooutput', label: 'MacBook Speakers' },
        ]);
        expect(picked).toEqual({ deviceId: 'out', label: 'MacBook Speakers' });
    });

    it('returns null when the browser exposes no audio outputs', () => {
        expect(pickSpeakerOutputDevice([{ deviceId: 'mic', kind: 'audioinput', label: 'Mic' }])).toBeNull();
    });

    it('picks earpiece/communications for non-speaker mode', () => {
        const picked = pickEarpieceOutputDevice([
            { deviceId: 'sp', kind: 'audiooutput', label: 'Speaker' },
            { deviceId: 'communications', kind: 'audiooutput', label: 'Communications' },
        ]);
        expect(picked?.deviceId).toBe('communications');
    });

    it('scores speaker labels higher than generic outputs', () => {
        expect(scoreSpeakerOutput({ deviceId: 'a', kind: 'audiooutput', label: 'Loudspeaker' }))
            .toBeGreaterThan(scoreSpeakerOutput({ deviceId: 'b', kind: 'audiooutput', label: 'HDMI' }));
    });
});
