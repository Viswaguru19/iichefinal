import { describe, expect, it } from 'vitest';
import { pickSendAudioTrack, pickSendVideoTrack } from '@/lib/meeting-send-tracks';

function fakeTrack(kind: 'audio' | 'video', readyState: MediaStreamTrackState, id: string = kind): MediaStreamTrack {
  return { kind, readyState, id } as MediaStreamTrack;
}

describe('meeting send tracks', () => {
  it('keeps a live screen-share track on the wire when a new peer joins', () => {
    const camera = fakeTrack('video', 'live', 'cam');
    const screen = fakeTrack('video', 'live', 'screen');
    const local = { getVideoTracks: () => [camera], getAudioTracks: () => [] } as unknown as MediaStream;
    expect(pickSendVideoTrack(local, screen)?.id).toBe('screen');
  });

  it('falls back to the camera after the screen-share track ends', () => {
    const camera = fakeTrack('video', 'live', 'cam');
    const endedScreen = fakeTrack('video', 'ended', 'screen');
    const local = { getVideoTracks: () => [camera], getAudioTracks: () => [] } as unknown as MediaStream;
    expect(pickSendVideoTrack(local, endedScreen)?.id).toBe('cam');
  });

  it('sends the live microphone track', () => {
    const live = fakeTrack('audio', 'live', 'mic');
    const ended = fakeTrack('audio', 'ended', 'old');
    const local = { getAudioTracks: () => [ended, live], getVideoTracks: () => [] } as unknown as MediaStream;
    expect(pickSendAudioTrack(local)?.id).toBe('mic');
  });

  it('returns null when nothing is live', () => {
    const local = {
      getAudioTracks: () => [fakeTrack('audio', 'ended', 'a')],
      getVideoTracks: () => [fakeTrack('video', 'ended', 'v')],
    } as unknown as MediaStream;
    expect(pickSendAudioTrack(local)).toBeNull();
    expect(pickSendVideoTrack(local, null)).toBeNull();
  });
});
