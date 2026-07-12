import { NgxPlayerControlService } from './ngx-player-control.service';
import { PlayerService } from './player.service';
import { PlayerStateService } from './player-state.service';

/** Minimal fake matching the subset of `PlayerService` the control service calls. */
function createFakePlayerService() {
  return {
    loadSource: vi.fn(),
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    seek: vi.fn(),
    setVolume: vi.fn(),
    setMuted: vi.fn(),
    setPlaybackRate: vi.fn(),
    setQuality: vi.fn(),
    toggleSubtitles: vi.fn(),
    setSubtitle: vi.fn(),
  } as unknown as PlayerService;
}

describe('NgxPlayerControlService', () => {
  let service: NgxPlayerControlService;
  let ps: ReturnType<typeof createFakePlayerService>;
  let ss: PlayerStateService;

  beforeEach(() => {
    service = new NgxPlayerControlService();
    ps = createFakePlayerService();
    ss = new PlayerStateService();
  });

  describe('registration', () => {
    it('is not registered before _register is called', () => {
      expect(service.isRegistered()).toBe(false);
      expect(service.isRegistered('cam1')).toBe(false);
    });

    it('_register makes the player controllable under its ID (default)', () => {
      service._register('default', ps, ss);
      expect(service.isRegistered()).toBe(true);
      expect(service.getState()).toBe(ss);
    });

    it('_register supports a custom playerId', () => {
      service._register('cam1', ps, ss);
      expect(service.isRegistered('cam1')).toBe(true);
      expect(service.isRegistered('default')).toBe(false);
    });

    it('_unregister removes the player from the registry', () => {
      service._register('default', ps, ss);
      service._unregister('default');
      expect(service.isRegistered()).toBe(false);
      expect(service.getState()).toBeNull();
    });
  });

  describe('commands on a registered player', () => {
    beforeEach(() => {
      service._register('default', ps, ss);
    });

    it('load() delegates to PlayerService.loadSource', () => {
      service.load('a.m3u8', { autoplay: true });
      expect(ps.loadSource).toHaveBeenCalledWith('a.m3u8', { autoplay: true });
    });

    it('load() defaults overrides to an empty object', () => {
      service.load('a.mp4');
      expect(ps.loadSource).toHaveBeenCalledWith('a.mp4', {});
    });

    it('play() delegates to PlayerService.play and resolves', async () => {
      await expect(service.play()).resolves.toBeUndefined();
      expect(ps.play).toHaveBeenCalled();
    });

    it('pause() delegates to PlayerService.pause', () => {
      service.pause();
      expect(ps.pause).toHaveBeenCalled();
    });

    it('seek() delegates to PlayerService.seek', () => {
      service.seek(42);
      expect(ps.seek).toHaveBeenCalledWith(42);
    });

    it('setVolume() delegates to PlayerService.setVolume', () => {
      service.setVolume(0.5);
      expect(ps.setVolume).toHaveBeenCalledWith(0.5);
    });

    it('setMuted() delegates to PlayerService.setMuted', () => {
      service.setMuted(true);
      expect(ps.setMuted).toHaveBeenCalledWith(true);
    });

    it('setPlaybackRate() delegates to PlayerService.setPlaybackRate', () => {
      service.setPlaybackRate(1.5);
      expect(ps.setPlaybackRate).toHaveBeenCalledWith(1.5);
    });

    it('setQuality() delegates to PlayerService.setQuality', () => {
      service.setQuality('720p');
      expect(ps.setQuality).toHaveBeenCalledWith('720p');
    });

    it('toggleSubtitles() delegates to PlayerService.toggleSubtitles', () => {
      service.toggleSubtitles();
      expect(ps.toggleSubtitles).toHaveBeenCalled();
    });

    it('setSubtitle() delegates to PlayerService.setSubtitle', () => {
      service.setSubtitle('en');
      expect(ps.setSubtitle).toHaveBeenCalledWith('en');
    });

    it('getState() returns the registered PlayerStateService', () => {
      expect(service.getState()).toBe(ss);
    });
  });

  describe('commands on an unregistered player', () => {
    it('load() is a silent no-op', () => {
      expect(() => service.load('a.mp4')).not.toThrow();
    });

    it('play() resolves immediately without a registered player', async () => {
      await expect(service.play('missing')).resolves.toBeUndefined();
    });

    it('pause() / seek() / setVolume() / setMuted() are silent no-ops', () => {
      expect(() => service.pause('missing')).not.toThrow();
      expect(() => service.seek(10, 'missing')).not.toThrow();
      expect(() => service.setVolume(1, 'missing')).not.toThrow();
      expect(() => service.setMuted(false, 'missing')).not.toThrow();
    });

    it('getState() returns null', () => {
      expect(service.getState('missing')).toBeNull();
    });

    it('isRegistered() returns false', () => {
      expect(service.isRegistered('missing')).toBe(false);
    });
  });

  describe('multiple players', () => {
    it('routes commands to the correct player by ID', () => {
      const ps2 = createFakePlayerService();
      const ss2 = new PlayerStateService();

      service._register('cam1', ps, ss);
      service._register('cam2', ps2, ss2);

      service.play('cam2');

      expect(ps2.play).toHaveBeenCalled();
      expect(ps.play).not.toHaveBeenCalled();
      expect(service.getState('cam1')).toBe(ss);
      expect(service.getState('cam2')).toBe(ss2);
    });
  });
});
