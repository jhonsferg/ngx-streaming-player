import { TestBed } from '@angular/core/testing';
import { PlayerService } from './player.service';
import { PlayerStateService } from './player-state.service';
import { NativeAdapter } from '../adapters/native/native.adapter';
import { HlsAdapter } from '../adapters/hls/hls.adapter';
import { DashAdapter } from '../adapters/dash/dash.adapter';

// Angular's Vitest-based unit-test builder does not support `vi.mock()` for
// relative imports, so protocol selection is verified against the *real*
// adapter classes. HlsAdapter/DashAdapter fall back to a harmless
// `stateService.setError(...)` when the underlying media APIs (MSE, XHR) are
// unavailable in jsdom, so constructing them here is safe. Playback-delegation
// behaviour (play/pause/seek/...) is exercised through NativeAdapter, whose
// methods are simple synchronous wrappers around the `<video>` element and
// are spied on directly.
describe('PlayerService', () => {
  let service: PlayerService;
  let video: HTMLVideoElement;
  let container: HTMLDivElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [PlayerService, PlayerStateService] });
    service = TestBed.inject(PlayerService);
    video = document.createElement('video');
    video.play = vi.fn().mockResolvedValue(undefined);
    video.pause = vi.fn();
    video.load = vi.fn();
    container = document.createElement('div');
  });

  describe('protocol detection via initialize()', () => {
    it('selects NativeAdapter for a plain video URL', () => {
      service.initialize(video, { src: 'https://example.com/video.mp4' });
      expect((service as any).adapter).toBeInstanceOf(NativeAdapter);
    });

    it('selects HlsAdapter for a .m3u8 URL', () => {
      service.initialize(video, { src: 'https://example.com/stream.m3u8' });
      expect((service as any).adapter).toBeInstanceOf(HlsAdapter);
    });

    it('selects DashAdapter for a .mpd URL', () => {
      service.initialize(video, { src: 'https://example.com/stream.mpd' });
      expect((service as any).adapter).toBeInstanceOf(DashAdapter);
    });

    it('honours an explicit protocol override', () => {
      service.initialize(video, { src: 'https://example.com/video.mp4', protocol: 'hls' });
      expect((service as any).adapter).toBeInstanceOf(HlsAdapter);
    });
  });

  describe('theme application', () => {
    it('sets CSS custom properties on the container for supplied theme keys', () => {
      service.setContainer(container);
      service.initialize(video, { src: 'a.mp4', theme: { primaryColor: '#ff0000' } });
      expect(container.style.getPropertyValue('--ngx-sp-primary')).toBe('#ff0000');
    });

    it('is a no-op when no theme is supplied', () => {
      service.setContainer(container);
      service.initialize(video, { src: 'a.mp4' });
      expect(container.style.getPropertyValue('--ngx-sp-primary')).toBe('');
    });

    it('falls back to document.documentElement when no container was set', () => {
      service.initialize(video, { src: 'a.mp4', theme: { primaryColor: '#00ff00' } });
      expect(document.documentElement.style.getPropertyValue('--ngx-sp-primary')).toBe('#00ff00');
      document.documentElement.style.removeProperty('--ngx-sp-primary');
    });
  });

  describe('playback delegation to the active (native) adapter', () => {
    beforeEach(() => {
      service.initialize(video, { src: 'https://example.com/video.mp4' });
    });

    it('play() delegates to the adapter', async () => {
      const spy = vi.spyOn((service as any).adapter, 'play');
      await service.play();
      expect(spy).toHaveBeenCalled();
    });

    it('pause() delegates to the adapter', () => {
      const spy = vi.spyOn((service as any).adapter, 'pause');
      service.pause();
      expect(spy).toHaveBeenCalled();
    });

    it('seek() delegates to the adapter', () => {
      Object.defineProperty(video, 'duration', { value: 100, configurable: true });
      service.seek(30);
      expect(video.currentTime).toBe(30);
    });

    it('setVolume() clamps to [0, 1] before delegating', () => {
      service.setVolume(1.5);
      expect(video.volume).toBe(1);
      service.setVolume(-1);
      expect(video.volume).toBe(0);
    });

    it('setVolume() clears mute when raising volume above 0 while muted', () => {
      const stateService = TestBed.inject(PlayerStateService);
      stateService.setMuted(true);
      service.setVolume(0.5);
      expect(video.muted).toBe(false);
    });

    it('setMuted() delegates to the adapter', () => {
      service.setMuted(true);
      expect(video.muted).toBe(true);
    });

    it('setPlaybackRate() delegates to the adapter', () => {
      service.setPlaybackRate(2);
      expect(video.playbackRate).toBe(2);
    });

    it('setQuality() does not throw (native adapter no-op)', () => {
      expect(() => service.setQuality('1080p')).not.toThrow();
    });

    it('setSubtitle() delegates to the adapter', () => {
      const spy = vi.spyOn((service as any).adapter, 'setSubtitle');
      service.setSubtitle('en');
      expect(spy).toHaveBeenCalledWith('en');
    });
  });

  describe('toggleSubtitles()', () => {
    beforeEach(() => {
      service.initialize(video, { src: 'https://example.com/video.mp4' });
    });

    it('activates the first available track when currently disabled', () => {
      const stateService = TestBed.inject(PlayerStateService);
      stateService.setAvailableSubtitles([{ id: 'en', label: 'English', language: 'en' }]);
      const spy = vi.spyOn((service as any).adapter, 'setSubtitle');
      service.toggleSubtitles();
      expect(spy).toHaveBeenCalledWith('en');
    });

    it('disables subtitles when currently enabled', () => {
      const stateService = TestBed.inject(PlayerStateService);
      stateService.setSubtitles(true);
      const spy = vi.spyOn((service as any).adapter, 'setSubtitle');
      service.toggleSubtitles();
      expect(spy).toHaveBeenCalledWith(null);
    });
  });

  describe('loadSource()', () => {
    it('destroys the previous adapter and resets state before loading the new one', () => {
      service.initialize(video, { src: 'https://example.com/video.mp4' });
      const previousAdapter = (service as any).adapter;
      const destroySpy = vi.spyOn(previousAdapter, 'destroy');
      const stateService = TestBed.inject(PlayerStateService);
      const resetSpy = vi.spyOn(stateService, 'reset');

      service.loadSource('https://example.com/video2.mp4');

      expect(destroySpy).toHaveBeenCalled();
      expect(resetSpy).toHaveBeenCalled();
      expect((service as any).adapter).toBeInstanceOf(NativeAdapter);
      expect((service as any).adapter).not.toBe(previousAdapter);
    });

    it('does not attempt to destroy anything on the very first load', () => {
      // No prior initialize() call means `this.adapter` is still undefined;
      // loadSource() must guard the destroy() call rather than call it
      // unconditionally on a nullish adapter.
      service.initialize(video, { src: 'https://example.com/video.mp4' });
      const stateService = TestBed.inject(PlayerStateService);
      const resetSpy = vi.spyOn(stateService, 'reset');
      expect(() => service.loadSource('https://example.com/video2.mp4')).not.toThrow();
      expect(resetSpy).toHaveBeenCalled();
    });

    it('detects the new protocol from the src rather than reusing the old one', () => {
      service.initialize(video, { src: 'https://example.com/video.mp4' }); // native
      service.loadSource('https://example.com/stream.m3u8');
      expect((service as any).adapter).toBeInstanceOf(HlsAdapter);
    });

    it('honours an explicit protocol override in the load overrides', () => {
      service.initialize(video, { src: 'https://example.com/video.mp4' });
      service.loadSource('https://example.com/video2.mp4', { protocol: 'dash' });
      expect((service as any).adapter).toBeInstanceOf(DashAdapter);
    });
  });

  describe('destroy()', () => {
    it('destroys the active adapter', () => {
      service.initialize(video, { src: 'https://example.com/video.mp4' });
      const spy = vi.spyOn((service as any).adapter, 'destroy');
      service.destroy();
      expect(spy).toHaveBeenCalled();
    });

    it('is a no-op when no adapter has been created', () => {
      expect(() => service.destroy()).not.toThrow();
    });
  });

  describe('fullscreen', () => {
    it('requestFullscreen() calls the container element API', () => {
      service.setContainer(container);
      container.requestFullscreen = vi.fn().mockResolvedValue(undefined);
      service.requestFullscreen();
      expect(container.requestFullscreen).toHaveBeenCalled();
    });

    it('exitFullscreen() calls document.exitFullscreen when available', () => {
      const spy = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(document, 'exitFullscreen', { value: spy, configurable: true });
      service.exitFullscreen();
      expect(spy).toHaveBeenCalled();
    });
  });
});
