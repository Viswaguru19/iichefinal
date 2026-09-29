import { describe, expect, it } from 'vitest';
import {
    isAppleWebKitBrowser,
    isMobileMeetingClient,
    pickPreferredAudioInput,
    pickPreferredVideoInput,
    shouldReplaceAudioDevice,
    shouldReplaceVideoDevice,
} from '@/lib/meeting-devices';

describe('meeting devices', () => {
    it('treats desktop Safari as WebKit and Chrome on Mac as not WebKit', () => {
        expect(isAppleWebKitBrowser(
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
        )).toBe(true);
        expect(isAppleWebKitBrowser(
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        )).toBe(false);
    });

    it('does not treat desktop Mac as a phone for facingMode', () => {
        expect(isMobileMeetingClient(
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
        )).toBe(false);
        expect(isMobileMeetingClient(
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        )).toBe(true);
    });

    it('prefers FaceTime over Continuity Camera and Desk View', () => {
        const picked = pickPreferredVideoInput([
            { deviceId: 'iphone', kind: 'videoinput', label: 'Viswa’s iPhone Camera (Continuity Camera)' },
            { deviceId: 'desk', kind: 'videoinput', label: 'Desk View' },
            { deviceId: 'ft', kind: 'videoinput', label: 'FaceTime HD Camera' },
        ]);
        expect(picked?.deviceId).toBe('ft');
        expect(shouldReplaceVideoDevice('Viswa’s iPhone Camera (Continuity Camera)', picked)).toBe(true);
        expect(shouldReplaceVideoDevice('FaceTime HD Camera', picked)).toBe(false);
    });

    it('prefers the MacBook microphone over iPhone Continuity audio', () => {
        const picked = pickPreferredAudioInput([
            { deviceId: 'phone', kind: 'audioinput', label: 'iPhone Microphone' },
            { deviceId: 'mac', kind: 'audioinput', label: 'MacBook Air Microphone' },
        ]);
        expect(picked?.deviceId).toBe('mac');
        expect(shouldReplaceAudioDevice('iPhone Microphone', picked)).toBe(true);
        expect(shouldReplaceAudioDevice('MacBook Air Microphone', picked)).toBe(false);
    });
});
