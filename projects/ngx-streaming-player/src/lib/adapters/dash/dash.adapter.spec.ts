import { DashAdapter } from './dash.adapter';
import { PlayerStateService } from '../../services/player-state.service';
import { PlayerConfig } from '../../models/player.models';

// jsdom has no Media Source Extensions support, so `DashAdapter.isSupported()`
// is always `false` here and `initialize()` always falls into the
// "DASH is not supported" branch, which is exercised explicitly below. The
// native `<video>` event-forwarding and playback-delegation methods are
// identical in shape to `NativeAdapter` / `HlsAdapter` and are covered the
// same way.
describe('DashAdapter', () => {
  let video: HTMLVideoElement;
  let stateService: PlayerStateService;
  let adapter: DashAdapter;

  const baseConfig: PlayerConfig = { src: 'https://example.com/manifest.mpd' };

  beforeEach(() => {
    video = document.createElement('video');
    video.play = vi.fn().mockResolvedValue(undefined);
    video.pause = vi.fn();
    stateService = new PlayerStateService();
    adapter = new DashAdapter(video, stateService);
  });

  describe('isSupported', () => {
    it('returns false when window.MediaSource is unavailable (jsdom)', () => {
      expect(DashAdapter.isSupported()).toBe(false);
    });
  });

  describe('initialize', () => {
    it('surfaces an error when MSE is not available', () => {
      adapter.initialize(baseConfig);
      expect(stateService.error()).toBe('DASH is not supported in this browser.');
    });

    it('sets the poster when provided', () => {
      adapter.initialize({ ...baseConfig, poster: 'poster.jpg' });
      expect(video.poster).toContain('poster.jpg');
    });

    it('applies the initial volume when provided', () => {
      adapter.initialize({ ...baseConfig, volume: 0.3 });
      expect(video.volume).toBe(0.3);
    });

    it('applies the initial muted state when provided', () => {
      adapter.initialize({ ...baseConfig, muted: true });
      expect(video.muted).toBe(true);
    });

    it('is not ready before initialize is called', () => {
      expect(adapter.isReady()).toBe(false);
    });
  });

  describe('native event forwarding', () => {
    beforeEach(() => {
      adapter.initialize(baseConfig);
    });

    it('forwards play/pause to isPlaying', () => {
      video.dispatchEvent(new Event('play'));
      expect(stateService.isPlaying()).toBe(true);
      video.dispatchEvent(new Event('pause'));
      expect(stateService.isPlaying()).toBe(false);
    });

    it('forwards waiting/playing/canplay to isBuffering', () => {
      video.dispatchEvent(new Event('waiting'));
      expect(stateService.isBuffering()).toBe(true);
      video.dispatchEvent(new Event('playing'));
      expect(stateService.isBuffering()).toBe(false);
      video.dispatchEvent(new Event('waiting'));
      video.dispatchEvent(new Event('canplay'));
      expect(stateService.isBuffering()).toBe(false);
    });

    it('forwards timeupdate to currentTime', () => {
      Object.defineProperty(video, 'currentTime', { value: 9, configurable: true });
      video.dispatchEvent(new Event('timeupdate'));
      expect(stateService.currentTime()).toBe(9);
    });

    it('forwards durationchange, marking infinite durations as live', () => {
      Object.defineProperty(video, 'duration', { value: Infinity, configurable: true });
      video.dispatchEvent(new Event('durationchange'));
      expect(stateService.duration()).toBe(Infinity);
      expect(stateService.isLive()).toBe(true);
    });

    it('forwards volumechange to volume and muted', () => {
      Object.defineProperty(video, 'volume', { value: 0.55, configurable: true });
      Object.defineProperty(video, 'muted', { value: true, configurable: true });
      video.dispatchEvent(new Event('volumechange'));
      expect(stateService.volume()).toBe(0.55);
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
      Object.defineProperty(video, 'duration', { value: 40, configurable: true });
      Object.defineProperty(video, 'buffered', {
        value: { length: 1, end: () => 20 },
        configurable: true,
      });
      video.dispatchEvent(new Event('progress'));
      expect(stateService.bufferedPercentage()).toBe(50);
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
      adapter.seek(30);
      expect(video.currentTime).toBe(30);
    });

    it('seek() ignores out-of-range values', () => {
      Object.defineProperty(video, 'duration', { value: 100, configurable: true });
      Object.defineProperty(video, 'currentTime', {
        value: 10,
        writable: true,
        configurable: true,
      });
      adapter.seek(500);
      expect(video.currentTime).toBe(10);
      adapter.seek(-5);
      expect(video.currentTime).toBe(10);
    });

    it('setVolume() clamps to [0, 1]', () => {
      adapter.setVolume(2);
      expect(video.volume).toBe(1);
      adapter.setVolume(-1);
      expect(video.volume).toBe(0);
    });

    it('setMuted() delegates to the video element', () => {
      adapter.setMuted(true);
      expect(video.muted).toBe(true);
    });

    it('setPlaybackRate() delegates to the video element', () => {
      adapter.setPlaybackRate(1.5);
      expect(video.playbackRate).toBe(1.5);
    });

    it('setQuality() is a no-op when dash.js was never initialised', () => {
      expect(() => adapter.setQuality('1080p')).not.toThrow();
      expect(stateService.quality()).toBe('auto');
    });

    it('setSubtitle() is a no-op when dash.js was never initialised', () => {
      expect(() => adapter.setSubtitle('1')).not.toThrow();
      expect(stateService.subtitlesEnabled()).toBe(false);
    });
  });

  describe('destroy', () => {
    it('does not throw and resets isReady', () => {
      adapter.initialize(baseConfig);
      expect(() => adapter.destroy()).not.toThrow();
      expect(adapter.isReady()).toBe(false);
    });

    it('does not throw when called without a prior initialize()', () => {
      expect(() => adapter.destroy()).not.toThrow();
    });

    it('stops forwarding native events after destroy', () => {
      adapter.initialize(baseConfig);
      adapter.destroy();
      video.dispatchEvent(new Event('play'));
      expect(stateService.isPlaying()).toBe(false);
    });
  });
});
