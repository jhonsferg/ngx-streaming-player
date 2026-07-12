import { NativeAdapter } from './native.adapter';
import { PlayerStateService } from '../../services/player-state.service';
import { PlayerConfig } from '../../models/player.models';

describe('NativeAdapter', () => {
  let video: HTMLVideoElement;
  let stateService: PlayerStateService;
  let adapter: NativeAdapter;

  beforeEach(() => {
    video = document.createElement('video');
    // jsdom does not implement real media playback - stub the APIs that throw
    // "not implemented" so play()/pause() behave like a resolved/no-op call.
    video.play = vi.fn().mockResolvedValue(undefined);
    video.pause = vi.fn();
    video.load = vi.fn();
    stateService = new PlayerStateService();
    adapter = new NativeAdapter(video, stateService);
  });

  const baseConfig: PlayerConfig = { src: 'https://example.com/video.mp4' };

  describe('initialize', () => {
    it('sets the video src from config', () => {
      adapter.initialize(baseConfig);
      expect(video.src).toBe('https://example.com/video.mp4');
    });

    it('sets the poster when provided', () => {
      adapter.initialize({ ...baseConfig, poster: 'https://example.com/poster.jpg' });
      expect(video.poster).toBe('https://example.com/poster.jpg');
    });

    it('applies the initial volume when provided', () => {
      adapter.initialize({ ...baseConfig, volume: 0.4 });
      expect(video.volume).toBe(0.4);
    });

    it('applies the initial muted state when provided', () => {
      adapter.initialize({ ...baseConfig, muted: true });
      expect(video.muted).toBe(true);
    });

    it('marks the adapter ready after initialize', () => {
      adapter.initialize(baseConfig);
      expect(adapter.isReady()).toBe(true);
    });

    it('is not ready before initialize is called', () => {
      expect(adapter.isReady()).toBe(false);
    });

    it('detects subtitle tracks and autoplays on loadedmetadata', () => {
      const playSpy = vi.spyOn(adapter, 'play');
      adapter.initialize({ ...baseConfig, autoplay: true });

      video.dispatchEvent(new Event('loadedmetadata'));

      expect(playSpy).toHaveBeenCalled();
      expect(stateService.supportsSubtitles()).toBe(false);
      expect(stateService.availableSubtitles()).toEqual([]);
    });

    it('does not autoplay when autoplay is false', () => {
      const playSpy = vi.spyOn(adapter, 'play');
      adapter.initialize({ ...baseConfig, autoplay: false });

      video.dispatchEvent(new Event('loadedmetadata'));

      expect(playSpy).not.toHaveBeenCalled();
    });
  });

  describe('native event forwarding', () => {
    beforeEach(() => {
      adapter.initialize(baseConfig);
    });

    it('forwards play/pause events to isPlaying', () => {
      video.dispatchEvent(new Event('play'));
      expect(stateService.isPlaying()).toBe(true);

      video.dispatchEvent(new Event('pause'));
      expect(stateService.isPlaying()).toBe(false);
    });

    it('forwards waiting/playing/canplay events to isBuffering', () => {
      video.dispatchEvent(new Event('waiting'));
      expect(stateService.isBuffering()).toBe(true);

      video.dispatchEvent(new Event('playing'));
      expect(stateService.isBuffering()).toBe(false);

      video.dispatchEvent(new Event('waiting'));
      video.dispatchEvent(new Event('canplay'));
      expect(stateService.isBuffering()).toBe(false);
    });

    it('forwards timeupdate to currentTime', () => {
      Object.defineProperty(video, 'currentTime', { value: 12.5, configurable: true });
      video.dispatchEvent(new Event('timeupdate'));
      expect(stateService.currentTime()).toBe(12.5);
    });

    it('forwards durationchange to duration, marking live streams as infinite', () => {
      Object.defineProperty(video, 'duration', { value: Infinity, configurable: true });
      video.dispatchEvent(new Event('durationchange'));
      expect(stateService.duration()).toBe(Infinity);
      expect(stateService.isLive()).toBe(true);
    });

    it('forwards durationchange for finite durations without marking live', () => {
      Object.defineProperty(video, 'duration', { value: 90, configurable: true });
      video.dispatchEvent(new Event('durationchange'));
      expect(stateService.duration()).toBe(90);
      expect(stateService.isLive()).toBe(false);
    });

    it('forwards volumechange to volume and muted', () => {
      Object.defineProperty(video, 'volume', { value: 0.2, configurable: true });
      Object.defineProperty(video, 'muted', { value: true, configurable: true });
      video.dispatchEvent(new Event('volumechange'));
      expect(stateService.volume()).toBe(0.2);
      expect(stateService.muted()).toBe(true);
    });

    it('forwards ratechange to playbackRate', () => {
      Object.defineProperty(video, 'playbackRate', { value: 1.75, configurable: true });
      video.dispatchEvent(new Event('ratechange'));
      expect(stateService.playbackRate()).toBe(1.75);
    });

    it('forwards ended to isPlaying=false and isEnded=true', () => {
      video.dispatchEvent(new Event('play'));
      video.dispatchEvent(new Event('ended'));
      expect(stateService.isPlaying()).toBe(false);
      expect(stateService.isEnded()).toBe(true);
    });

    it('forwards error events to stateService.error', () => {
      const errorEvent = new Event('error');
      video.dispatchEvent(errorEvent);
      expect(stateService.error()).toBe(errorEvent);
    });

    it('updates bufferedPercentage on progress when duration is known', () => {
      Object.defineProperty(video, 'duration', { value: 100, configurable: true });
      Object.defineProperty(video, 'buffered', {
        value: { length: 1, end: () => 40 },
        configurable: true,
      });
      video.dispatchEvent(new Event('progress'));
      expect(stateService.bufferedPercentage()).toBe(40);
    });

    it('does not update bufferedPercentage when duration is not finite', () => {
      Object.defineProperty(video, 'duration', { value: Infinity, configurable: true });
      Object.defineProperty(video, 'buffered', {
        value: { length: 1, end: () => 40 },
        configurable: true,
      });
      video.dispatchEvent(new Event('progress'));
      expect(stateService.bufferedPercentage()).toBe(0);
    });
  });

  describe('playback controls', () => {
    beforeEach(() => {
      adapter.initialize(baseConfig);
    });

    it('play() delegates to the video element', () => {
      adapter.play();
      expect(video.play).toHaveBeenCalled();
    });

    it('pause() delegates to the video element', () => {
      adapter.pause();
      expect(video.pause).toHaveBeenCalled();
    });

    it('seek() sets currentTime within [0, duration]', () => {
      Object.defineProperty(video, 'duration', { value: 100, configurable: true });
      adapter.seek(50);
      expect(video.currentTime).toBe(50);
    });

    it('seek() ignores out-of-range values', () => {
      Object.defineProperty(video, 'duration', { value: 100, configurable: true });
      Object.defineProperty(video, 'currentTime', {
        value: 10,
        writable: true,
        configurable: true,
      });
      adapter.seek(200);
      expect(video.currentTime).toBe(10);
      adapter.seek(-5);
      expect(video.currentTime).toBe(10);
    });

    it('setVolume() clamps to [0, 1]', () => {
      adapter.setVolume(1.5);
      expect(video.volume).toBe(1);
      adapter.setVolume(-1);
      expect(video.volume).toBe(0);
      adapter.setVolume(0.6);
      expect(video.volume).toBe(0.6);
    });

    it('setMuted() delegates to the video element', () => {
      adapter.setMuted(true);
      expect(video.muted).toBe(true);
    });

    it('setPlaybackRate() delegates to the video element', () => {
      adapter.setPlaybackRate(2);
      expect(video.playbackRate).toBe(2);
    });

    it('setQuality() is a no-op', () => {
      expect(() => adapter.setQuality('1080p')).not.toThrow();
    });
  });

  describe('setSubtitle', () => {
    // jsdom does not implement HTMLMediaElement.addTextTrack(), so the
    // read-only `textTracks` list is stubbed directly with plain track
    // objects that expose the same `kind` / `mode` surface the adapter reads.
    function stubTextTracks(tracks: Array<{ kind: string; mode: string }>): void {
      Object.defineProperty(video, 'textTracks', {
        value: tracks,
        configurable: true,
      });
    }

    beforeEach(() => {
      adapter.initialize(baseConfig);
    });

    it('activates the matching subtitle track and hides the rest', () => {
      const tracks = [
        { kind: 'subtitles', mode: 'disabled' },
        { kind: 'subtitles', mode: 'disabled' },
      ];
      stubTextTracks(tracks);

      adapter.setSubtitle('1');

      expect(tracks[0].mode).toBe('hidden');
      expect(tracks[1].mode).toBe('showing');
      expect(stateService.subtitlesEnabled()).toBe(true);
      expect(stateService.activeSubtitleId()).toBe('1');
    });

    it('disables all tracks when id is null', () => {
      const tracks = [{ kind: 'subtitles', mode: 'disabled' }];
      stubTextTracks(tracks);

      adapter.setSubtitle('0');
      adapter.setSubtitle(null);

      expect(tracks[0].mode).toBe('hidden');
      expect(stateService.subtitlesEnabled()).toBe(false);
      expect(stateService.activeSubtitleId()).toBeNull();
    });

    it('ignores non-subtitle/caption tracks', () => {
      const tracks = [{ kind: 'metadata', mode: 'disabled' }];
      stubTextTracks(tracks);

      adapter.setSubtitle('0');

      expect(tracks[0].mode).toBe('disabled');
      expect(stateService.subtitlesEnabled()).toBe(false);
    });
  });

  describe('destroy', () => {
    it('aborts listeners, pauses, clears src, and resets isReady', () => {
      adapter.initialize(baseConfig);
      adapter.destroy();

      expect(video.pause).toHaveBeenCalled();
      expect(video.load).toHaveBeenCalled();
      expect(video.hasAttribute('src')).toBe(false);
      expect(adapter.isReady()).toBe(false);
    });

    it('does not throw when called without a prior initialize()', () => {
      expect(() => adapter.destroy()).not.toThrow();
    });

    it('stops forwarding events after destroy', () => {
      adapter.initialize(baseConfig);
      adapter.destroy();

      video.dispatchEvent(new Event('play'));
      expect(stateService.isPlaying()).toBe(false);
    });
  });
});
