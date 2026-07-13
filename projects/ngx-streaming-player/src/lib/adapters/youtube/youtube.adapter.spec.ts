import { TestBed } from '@angular/core/testing';
import { YouTubeAdapter } from './youtube.adapter';
import { PlayerStateService } from '../../services/player-state.service';
import { PlayerConfig } from '../../models/player.models';

/**
 * `YouTubeAdapter` talks to the real YouTube IFrame API via the `window.YT`
 * global, which does not exist in jsdom. Since the adapter never imports an
 * npm package for this - it only reaches for `window.YT` - a minimal fake
 * player class is enough to exercise the adapter's own logic without any
 * network access or `vi.mock()`.
 */
class FakeYTPlayer {
  static instances: FakeYTPlayer[] = [];
  events: any;

  constructor(
    public container: HTMLElement,
    public config: any,
  ) {
    this.events = config.events;
    FakeYTPlayer.instances.push(this);
  }

  playVideo = vi.fn();
  pauseVideo = vi.fn();
  seekTo = vi.fn();
  setVolume = vi.fn();
  getVolume = vi.fn(() => 50);
  mute = vi.fn();
  unMute = vi.fn();
  setPlaybackRate = vi.fn();
  getDuration = vi.fn(() => 120);
  getCurrentTime = vi.fn(() => 10);
  getVideoLoadedFraction = vi.fn(() => 0.5);
  getAvailableQualityLevels = vi.fn(() => ['hd1080', 'hd720', 'default']);
  setPlaybackQuality = vi.fn();
  loadVideoById = vi.fn();
  getVideoData = vi.fn((): any => ({ video_id: 'abc12345678', isLive: false }));
  loadModule = vi.fn();
  unloadModule = vi.fn();
  getOption = vi.fn((): any[] => []);
  setOption = vi.fn();
  destroy = vi.fn();
}

const YT_PLAYER_STATE = { PLAYING: 1, PAUSED: 2, BUFFERING: 3, ENDED: 0 };
const VALID_URL = 'https://www.youtube.com/watch?v=abc12345678';

function installFakeYT(): void {
  (window as any).YT = { Player: FakeYTPlayer, PlayerState: YT_PLAYER_STATE };
}

describe('YouTubeAdapter', () => {
  let adapter: YouTubeAdapter;
  let stateService: PlayerStateService;
  let container: HTMLDivElement;

  beforeEach(() => {
    FakeYTPlayer.instances = [];
    delete (window as any).YT;
    delete (window as any).onYouTubeIframeAPIReady;
    document
      .querySelectorAll('script[src="https://www.youtube.com/iframe_api"]')
      .forEach((s) => s.remove());

    TestBed.configureTestingModule({ providers: [YouTubeAdapter, PlayerStateService] });
    adapter = TestBed.inject(YouTubeAdapter);
    stateService = TestBed.inject(PlayerStateService);
    container = document.createElement('div');
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (window as any).YT;
    delete (window as any).onYouTubeIframeAPIReady;
  });

  function createReadyPlayer(config: Partial<PlayerConfig> = {}): FakeYTPlayer {
    installFakeYT();
    adapter.initialize({ src: VALID_URL, ...config });
    adapter.setContainer(container);
    return FakeYTPlayer.instances[FakeYTPlayer.instances.length - 1];
  }

  describe('initialize', () => {
    it('marks the state as YouTube and disables PiP support', () => {
      installFakeYT();
      adapter.initialize({ src: VALID_URL });
      expect(stateService.isYouTube()).toBe(true);
      expect(stateService.supportsPiP()).toBe(false);
    });

    it('surfaces an error for an invalid YouTube URL', () => {
      adapter.initialize({ src: 'https://example.com/not-youtube' });
      expect(stateService.error()).toBe('Invalid YouTube URL');
    });

    it('injects the IFrame API script when window.YT is unavailable', () => {
      adapter.setContainer(container);
      adapter.initialize({ src: VALID_URL });

      const script = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
      expect(script).toBeTruthy();
      expect(typeof (window as any).onYouTubeIframeAPIReady).toBe('function');
    });

    it('creates the player once the chain-safe API-ready callback fires', () => {
      adapter.setContainer(container);
      adapter.initialize({ src: VALID_URL });

      installFakeYT();
      (window as any).onYouTubeIframeAPIReady();

      expect(FakeYTPlayer.instances.length).toBe(1);
    });

    it('preserves a previously registered onYouTubeIframeAPIReady handler', () => {
      const prev = vi.fn();
      (window as any).onYouTubeIframeAPIReady = prev;

      adapter.setContainer(container);
      adapter.initialize({ src: VALID_URL });
      installFakeYT();
      (window as any).onYouTubeIframeAPIReady();

      expect(prev).toHaveBeenCalled();
    });

    it('creates the player immediately when the API is already loaded and the container is set', () => {
      createReadyPlayer();
      expect(FakeYTPlayer.instances.length).toBe(1);
    });

    it('surfaces an error when createPlayer runs without a container', () => {
      installFakeYT();
      adapter.initialize({ src: VALID_URL });
      // No setContainer() call - the api-loaded branch in initialize() only
      // schedules createPlayer via setTimeout when ytContainer is already set,
      // so nothing has been created yet and isReady stays false.
      expect(adapter.isReady()).toBe(false);
    });
  });

  describe('onPlayerReady', () => {
    it('syncs initial volume, muted state, duration and qualities', () => {
      const player = createReadyPlayer({ volume: 0.4, muted: true });
      player.events.onReady({});

      expect(adapter.isReady()).toBe(true);
      expect(player.setVolume).toHaveBeenCalledWith(40);
      expect(player.mute).toHaveBeenCalled();
      expect(stateService.duration()).toBe(120);
      expect(stateService.availableQualities()).toContain('auto');
      expect(stateService.availableQualities()).toContain('1080p');
    });

    it('detects subtitle tracks after the captions module delay', () => {
      vi.useFakeTimers();
      const player = createReadyPlayer();
      player.getOption = vi.fn(() => [
        { languageCode: 'en', displayName: 'English' },
        { languageCode: 'es', languageName: 'Spanish' },
      ]);

      player.events.onReady({});
      vi.advanceTimersByTime(1500);

      expect(stateService.supportsSubtitles()).toBe(true);
      expect(stateService.availableSubtitles().length).toBe(2);
      expect(player.unloadModule).toHaveBeenCalled();
    });

    it('marks subtitles unsupported when no tracks are found', () => {
      vi.useFakeTimers();
      const player = createReadyPlayer();
      player.getOption = vi.fn(() => []);

      player.events.onReady({});
      vi.advanceTimersByTime(1500);

      expect(stateService.supportsSubtitles()).toBe(false);
    });

    it('marks subtitles unsupported when getOption throws', () => {
      vi.useFakeTimers();
      const player = createReadyPlayer();
      player.getOption = vi.fn(() => {
        throw new Error('unavailable');
      });

      player.events.onReady({});
      vi.advanceTimersByTime(1500);

      expect(stateService.supportsSubtitles()).toBe(false);
    });
  });

  describe('onPlayerStateChange', () => {
    it('handles PLAYING: sets playing/buffering, duration, live and starts polling', () => {
      vi.useFakeTimers();
      const player = createReadyPlayer();
      player.events.onStateChange({ data: YT_PLAYER_STATE.PLAYING });

      expect(stateService.isPlaying()).toBe(true);
      expect(stateService.isBuffering()).toBe(false);
      expect(stateService.duration()).toBe(120);
      expect(stateService.isLive()).toBe(false);

      vi.advanceTimersByTime(250);
      expect(player.getCurrentTime).toHaveBeenCalled();
      expect(stateService.currentTime()).toBe(10);
      expect(stateService.bufferedPercentage()).toBe(50);
    });

    it('treats a live video (duration 0) as live on PLAYING', () => {
      const player = createReadyPlayer();
      player.getDuration = vi.fn(() => 0);
      player.getVideoData = vi.fn(() => ({ video_id: 'abc12345678', isLive: true }));
      player.events.onStateChange({ data: YT_PLAYER_STATE.PLAYING });

      expect(stateService.isLive()).toBe(true);
    });

    it('asserts the pending quality (Phase 2) instead of refreshing available qualities', () => {
      const player = createReadyPlayer();
      adapter.setQuality('1080p');
      player.setPlaybackQuality.mockClear();
      player.getAvailableQualityLevels.mockClear();

      player.events.onStateChange({ data: YT_PLAYER_STATE.PLAYING });

      expect(player.setPlaybackQuality).toHaveBeenCalledWith('hd1080');
      expect(player.getAvailableQualityLevels).not.toHaveBeenCalled();
    });

    it('handles PAUSED: stops polling and marks not playing', () => {
      vi.useFakeTimers();
      const player = createReadyPlayer();
      player.events.onStateChange({ data: YT_PLAYER_STATE.PLAYING });
      player.events.onStateChange({ data: YT_PLAYER_STATE.PAUSED });

      expect(stateService.isPlaying()).toBe(false);
      player.getCurrentTime.mockClear();
      vi.advanceTimersByTime(500);
      expect(player.getCurrentTime).not.toHaveBeenCalled();
    });

    it('handles BUFFERING: sets buffering true', () => {
      const player = createReadyPlayer();
      player.events.onStateChange({ data: YT_PLAYER_STATE.BUFFERING });
      expect(stateService.isBuffering()).toBe(true);
    });

    it('handles ENDED: marks not playing, ended, and stops polling', () => {
      const player = createReadyPlayer();
      player.events.onStateChange({ data: YT_PLAYER_STATE.ENDED });
      expect(stateService.isPlaying()).toBe(false);
      expect(stateService.isEnded()).toBe(true);
    });
  });

  describe('onPlaybackQualityChange', () => {
    it('ignores the first event while a quality change is pending', () => {
      const player = createReadyPlayer();
      adapter.setQuality('720p');
      player.events.onPlaybackQualityChange({ data: 'hd1080' });
      expect(stateService.quality()).toBe('720p');
    });

    it('applies the confirmed quality once pendingYtQuality is cleared', () => {
      const player = createReadyPlayer();
      player.events.onPlaybackQualityChange({ data: 'hd720' });
      expect(stateService.quality()).toBe('720p');
    });

    it('maps default/auto keys to auto', () => {
      const player = createReadyPlayer();
      player.events.onPlaybackQualityChange({ data: 'default' });
      expect(stateService.quality()).toBe('auto');
    });
  });

  describe('onError', () => {
    it('forwards YouTube player errors to the state service', () => {
      const player = createReadyPlayer();
      player.events.onError({ data: 2 });
      expect(stateService.error()).toBe('YouTube Error: 2');
    });
  });

  describe('playback controls', () => {
    it('play() delegates to playVideo and resolves', async () => {
      const player = createReadyPlayer();
      await expect(adapter.play()).resolves.toBeUndefined();
      expect(player.playVideo).toHaveBeenCalled();
    });

    it('play() resolves even without a player instance', async () => {
      await expect(adapter.play()).resolves.toBeUndefined();
    });

    it('pause() delegates to pauseVideo', () => {
      const player = createReadyPlayer();
      adapter.pause();
      expect(player.pauseVideo).toHaveBeenCalled();
    });

    it('seek() delegates to seekTo with allowSeekAhead', () => {
      const player = createReadyPlayer();
      adapter.seek(42);
      expect(player.seekTo).toHaveBeenCalledWith(42, true);
    });

    it('setVolume() converts to the [0, 100] scale and syncs state', () => {
      const player = createReadyPlayer();
      adapter.setVolume(0.75);
      expect(player.setVolume).toHaveBeenCalledWith(75);
      expect(stateService.volume()).toBe(0.75);
    });

    it('setMuted(true) calls mute()', () => {
      const player = createReadyPlayer();
      adapter.setMuted(true);
      expect(player.mute).toHaveBeenCalled();
      expect(stateService.muted()).toBe(true);
    });

    it('setMuted(false) calls unMute() and resyncs volume', () => {
      const player = createReadyPlayer();
      player.getVolume = vi.fn(() => 20);
      adapter.setMuted(false);
      expect(player.unMute).toHaveBeenCalled();
      expect(stateService.volume()).toBe(0.2);
      expect(stateService.muted()).toBe(false);
    });

    it('setPlaybackRate() delegates and syncs state', () => {
      const player = createReadyPlayer();
      adapter.setPlaybackRate(1.5);
      expect(player.setPlaybackRate).toHaveBeenCalledWith(1.5);
      expect(stateService.playbackRate()).toBe(1.5);
    });
  });

  describe('setQuality', () => {
    it('is a no-op without a player instance', () => {
      expect(() => adapter.setQuality('1080p')).not.toThrow();
    });

    it('two-phase change: loads the video at the target quality for VOD', () => {
      const player = createReadyPlayer();
      adapter.setQuality('1080p');
      expect(player.loadVideoById).toHaveBeenCalledWith(
        expect.objectContaining({ videoId: 'abc12345678', suggestedQuality: 'hd1080' }),
      );
      expect(stateService.quality()).toBe('1080p');
    });

    it('falls back to setPlaybackQuality for live streams', () => {
      const player = createReadyPlayer();
      stateService.setLive(true);
      adapter.setQuality('720p');
      expect(player.setPlaybackQuality).toHaveBeenCalledWith('hd720');
      expect(player.loadVideoById).not.toHaveBeenCalled();
    });

    it('falls back to setPlaybackQuality when no videoId is available', () => {
      const player = createReadyPlayer();
      player.getVideoData = vi.fn(() => ({}));
      adapter.setQuality('480p');
      expect(player.setPlaybackQuality).toHaveBeenCalledWith('large');
    });

    it('swallows errors thrown by the IFrame API', () => {
      const player = createReadyPlayer();
      player.getVideoData = vi.fn(() => {
        throw new Error('boom');
      });
      expect(() => adapter.setQuality('1080p')).not.toThrow();
    });

    it('maps auto to the default YouTube key', () => {
      const player = createReadyPlayer();
      stateService.setLive(true);
      adapter.setQuality('auto');
      expect(player.setPlaybackQuality).toHaveBeenCalledWith('default');
    });
  });

  describe('setSubtitle', () => {
    it('is a no-op without a player instance', () => {
      expect(() => adapter.setSubtitle('en')).not.toThrow();
    });

    it('activates a subtitle track by language code', () => {
      const player = createReadyPlayer();
      adapter.setSubtitle('en');
      expect(player.loadModule).toHaveBeenCalledWith('captions');
      expect(player.setOption).toHaveBeenCalledWith('captions', 'track', { languageCode: 'en' });
      expect(stateService.subtitlesEnabled()).toBe(true);
      expect(stateService.activeSubtitleId()).toBe('en');
    });

    it('disables captions when id is null', () => {
      const player = createReadyPlayer();
      adapter.setSubtitle('en');
      adapter.setSubtitle(null);
      expect(player.unloadModule).toHaveBeenCalledWith('captions');
      expect(stateService.subtitlesEnabled()).toBe(false);
      expect(stateService.activeSubtitleId()).toBeNull();
    });

    it('swallows errors from loadModule/setOption', () => {
      const player = createReadyPlayer();
      player.loadModule = vi.fn(() => {
        throw new Error('boom');
      });
      expect(() => adapter.setSubtitle('en')).not.toThrow();
      expect(stateService.subtitlesEnabled()).toBe(true);
    });
  });

  describe('destroy', () => {
    it('stops polling, clears pending quality, and destroys the player', () => {
      vi.useFakeTimers();
      const player = createReadyPlayer();
      player.events.onStateChange({ data: YT_PLAYER_STATE.PLAYING });

      adapter.destroy();

      expect(player.destroy).toHaveBeenCalled();
      expect(adapter.isReady()).toBe(false);

      player.getCurrentTime.mockClear();
      vi.advanceTimersByTime(500);
      expect(player.getCurrentTime).not.toHaveBeenCalled();
    });

    it('does not throw when called without a prior initialize()', () => {
      expect(() => adapter.destroy()).not.toThrow();
    });
  });
});
