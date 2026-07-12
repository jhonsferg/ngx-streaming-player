import { PlayerStateService } from './player-state.service';

describe('PlayerStateService', () => {
  let service: PlayerStateService;

  beforeEach(() => {
    service = new PlayerStateService();
  });

  it('starts with the documented initial values', () => {
    expect(service.isPlaying()).toBe(false);
    expect(service.isBuffering()).toBe(false);
    expect(service.currentTime()).toBe(0);
    expect(service.duration()).toBe(0);
    expect(service.volume()).toBe(1);
    expect(service.muted()).toBe(false);
    expect(service.playbackRate()).toBe(1);
    expect(service.quality()).toBe('auto');
    expect(service.currentQuality()).toBe('auto');
    expect(service.availableQualities()).toEqual([]);
    expect(service.isFullscreen()).toBe(false);
    expect(service.isPiP()).toBe(false);
    expect(service.isYouTube()).toBe(false);
    expect(service.isLive()).toBe(false);
    expect(service.subtitlesEnabled()).toBe(false);
    expect(service.supportsSubtitles()).toBe(false);
    expect(service.availableSubtitles()).toEqual([]);
    expect(service.activeSubtitleId()).toBeNull();
    expect(service.supportsPiP()).toBe(false);
    expect(service.error()).toBeNull();
    expect(service.isEnded()).toBe(false);
    expect(service.bufferedPercentage()).toBe(0);
  });

  describe('mutators', () => {
    it('setPlaying updates isPlaying', () => {
      service.setPlaying(true);
      expect(service.isPlaying()).toBe(true);
    });

    it('setBuffering updates isBuffering', () => {
      service.setBuffering(true);
      expect(service.isBuffering()).toBe(true);
    });

    it('setCurrentTime updates currentTime', () => {
      service.setCurrentTime(42);
      expect(service.currentTime()).toBe(42);
    });

    it('setDuration updates duration', () => {
      service.setDuration(120);
      expect(service.duration()).toBe(120);
    });

    it('setVolume updates volume', () => {
      service.setVolume(0.4);
      expect(service.volume()).toBe(0.4);
    });

    it('setMuted updates muted', () => {
      service.setMuted(true);
      expect(service.muted()).toBe(true);
    });

    it('setPlaybackRate updates playbackRate', () => {
      service.setPlaybackRate(1.5);
      expect(service.playbackRate()).toBe(1.5);
    });

    it('setQuality updates quality and currentQuality', () => {
      service.setQuality('720p');
      expect(service.quality()).toBe('720p');
      expect(service.currentQuality()).toBe('720p');
    });

    it('setAvailableQualities replaces the list', () => {
      service.setAvailableQualities(['auto', '480p', '1080p']);
      expect(service.availableQualities()).toEqual(['auto', '480p', '1080p']);
    });

    it('setFullscreen updates isFullscreen', () => {
      service.setFullscreen(true);
      expect(service.isFullscreen()).toBe(true);
    });

    it('setPiP updates isPiP', () => {
      service.setPiP(true);
      expect(service.isPiP()).toBe(true);
    });

    it('setBufferedPercentage updates bufferedPercentage', () => {
      service.setBufferedPercentage(55);
      expect(service.bufferedPercentage()).toBe(55);
    });

    it('setYouTube updates isYouTube', () => {
      service.setYouTube(true);
      expect(service.isYouTube()).toBe(true);
    });

    it('setLive updates isLive', () => {
      service.setLive(true);
      expect(service.isLive()).toBe(true);
    });

    it('setSubtitles updates subtitlesEnabled', () => {
      service.setSubtitles(true);
      expect(service.subtitlesEnabled()).toBe(true);
    });

    it('setSupportsSubtitles updates supportsSubtitles', () => {
      service.setSupportsSubtitles(true);
      expect(service.supportsSubtitles()).toBe(true);
    });

    it('setAvailableSubtitles replaces the track list', () => {
      const tracks = [{ id: 'en', label: 'English', language: 'en' }];
      service.setAvailableSubtitles(tracks);
      expect(service.availableSubtitles()).toEqual(tracks);
    });

    it('setActiveSubtitleId updates activeSubtitleId', () => {
      service.setActiveSubtitleId('en');
      expect(service.activeSubtitleId()).toBe('en');
    });

    it('setSupportsPiP updates supportsPiP', () => {
      service.setSupportsPiP(true);
      expect(service.supportsPiP()).toBe(true);
    });

    it('setError updates error', () => {
      const err = new Error('boom');
      service.setError(err);
      expect(service.error()).toBe(err);
    });

    it('setEnded updates isEnded', () => {
      service.setEnded(true);
      expect(service.isEnded()).toBe(true);
    });
  });

  describe('progress', () => {
    it('is 0 when duration is not yet known', () => {
      service.setCurrentTime(30);
      expect(service.progress()).toBe(0);
    });

    it('computes the percentage of time elapsed', () => {
      service.setDuration(200);
      service.setCurrentTime(50);
      expect(service.progress()).toBe(25);
    });
  });

  describe('formattedCurrentTime / formattedDuration', () => {
    it('formats sub-hour durations as mm:ss', () => {
      service.setCurrentTime(65);
      expect(service.formattedCurrentTime()).toBe('01:05');
    });

    it('formats hour-plus durations as h:mm:ss', () => {
      service.setDuration(3725); // 1h 2m 5s
      expect(service.formattedDuration()).toBe('1:02:05');
    });

    it('returns 00:00 for NaN', () => {
      service.setCurrentTime(NaN);
      expect(service.formattedCurrentTime()).toBe('00:00');
    });
  });

  describe('state', () => {
    it('aggregates every signal into a single snapshot', () => {
      service.setPlaying(true);
      service.setCurrentTime(10);
      service.setDuration(100);
      service.setVolume(0.5);
      service.setQuality('1080p');

      expect(service.state()).toEqual({
        isPlaying: true,
        isBuffering: false,
        currentTime: 10,
        duration: 100,
        volume: 0.5,
        muted: false,
        playbackRate: 1,
        quality: '1080p',
        availableQualities: [],
        isFullscreen: false,
        isPiP: false,
        isYouTube: false,
        isLive: false,
        subtitlesEnabled: false,
        isEnded: false,
        error: null,
      });
    });
  });

  describe('reset', () => {
    it('restores playback-related signals but preserves volume and muted', () => {
      service.setPlaying(true);
      service.setBuffering(true);
      service.setCurrentTime(50);
      service.setDuration(200);
      service.setVolume(0.3);
      service.setMuted(true);
      service.setPlaybackRate(2);
      service.setQuality('720p');
      service.setAvailableQualities(['720p', '1080p']);
      service.setFullscreen(true);
      service.setPiP(true);
      service.setYouTube(true);
      service.setLive(true);
      service.setSubtitles(true);
      service.setSupportsSubtitles(true);
      service.setAvailableSubtitles([{ id: 1, label: 'EN', language: 'en' }]);
      service.setActiveSubtitleId(1);
      service.setSupportsPiP(true);
      service.setEnded(true);
      service.setError('oops');
      service.setBufferedPercentage(80);

      service.reset();

      expect(service.isPlaying()).toBe(false);
      expect(service.isBuffering()).toBe(false);
      expect(service.currentTime()).toBe(0);
      expect(service.duration()).toBe(0);
      expect(service.playbackRate()).toBe(1);
      expect(service.quality()).toBe('auto');
      expect(service.availableQualities()).toEqual([]);
      expect(service.isFullscreen()).toBe(false);
      expect(service.isPiP()).toBe(false);
      expect(service.isYouTube()).toBe(false);
      expect(service.isLive()).toBe(false);
      expect(service.subtitlesEnabled()).toBe(false);
      expect(service.supportsSubtitles()).toBe(false);
      expect(service.availableSubtitles()).toEqual([]);
      expect(service.activeSubtitleId()).toBeNull();
      expect(service.supportsPiP()).toBe(false);
      expect(service.isEnded()).toBe(false);
      expect(service.error()).toBeNull();
      expect(service.bufferedPercentage()).toBe(0);

      // Preserved across reset.
      expect(service.volume()).toBe(0.3);
      expect(service.muted()).toBe(true);
    });
  });
});
