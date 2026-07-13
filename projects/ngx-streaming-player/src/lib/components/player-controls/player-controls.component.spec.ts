import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlayerControlsComponent } from './player-controls.component';
import { PlayerService } from '../../services/player.service';
import { PlayerStateService } from '../../services/player-state.service';
import { PlayerConfig } from '../../models/player.models';

describe('PlayerControlsComponent', () => {
  let component: PlayerControlsComponent;
  let fixture: ComponentFixture<PlayerControlsComponent>;
  let stateService: PlayerStateService;
  let playerService: PlayerService;

  const baseConfig: PlayerConfig = { src: 'https://example.com/video.mp4' };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlayerControlsComponent],
      providers: [PlayerService, PlayerStateService],
    }).compileComponents();

    fixture = TestBed.createComponent(PlayerControlsComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('config', baseConfig);
    stateService = TestBed.inject(PlayerStateService);
    playerService = TestBed.inject(PlayerService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('playback controls', () => {
    it('togglePlay() pauses while playing', () => {
      const spy = vi.spyOn(playerService, 'pause').mockImplementation(() => {});
      stateService.setPlaying(true);
      component.togglePlay();
      expect(spy).toHaveBeenCalled();
    });

    it('togglePlay() plays while paused', () => {
      const spy = vi.spyOn(playerService, 'play').mockResolvedValue(undefined);
      stateService.setPlaying(false);
      component.togglePlay();
      expect(spy).toHaveBeenCalled();
    });

    it('toggleMute() flips the muted state', () => {
      const spy = vi.spyOn(playerService, 'setMuted').mockImplementation(() => {});
      stateService.setMuted(false);
      component.toggleMute();
      expect(spy).toHaveBeenCalledWith(true);
    });

    it('togglePiP() requests PiP when not active', () => {
      const spy = vi.spyOn(playerService, 'requestPiP').mockImplementation(() => {});
      stateService.setPiP(false);
      component.togglePiP();
      expect(spy).toHaveBeenCalled();
    });

    it('togglePiP() exits PiP when active', () => {
      const spy = vi.spyOn(playerService, 'exitPiP').mockImplementation(() => {});
      stateService.setPiP(true);
      component.togglePiP();
      expect(spy).toHaveBeenCalled();
    });

    it('toggleSubtitles() delegates to the player service', () => {
      const spy = vi.spyOn(playerService, 'toggleSubtitles').mockImplementation(() => {});
      component.toggleSubtitles();
      expect(spy).toHaveBeenCalled();
    });

    it('setSubtitle() delegates and returns to the main settings panel', () => {
      const spy = vi.spyOn(playerService, 'setSubtitle').mockImplementation(() => {});
      component.activeSettingsTab.set('subtitles');
      component.setSubtitle('en');
      expect(spy).toHaveBeenCalledWith('en');
      expect(component.activeSettingsTab()).toBe('main');
    });

    it('skipBackward() clamps at 0', () => {
      const spy = vi.spyOn(playerService, 'seek').mockImplementation(() => {});
      stateService.setCurrentTime(5);
      component.skipBackward(10);
      expect(spy).toHaveBeenCalledWith(0);
    });

    it('skipForward() clamps at duration', () => {
      const spy = vi.spyOn(playerService, 'seek').mockImplementation(() => {});
      stateService.setDuration(20);
      stateService.setCurrentTime(15);
      component.skipForward(10);
      expect(spy).toHaveBeenCalledWith(20);
    });

    it('skipBackward() defaults to 10 seconds', () => {
      const spy = vi.spyOn(playerService, 'seek').mockImplementation(() => {});
      stateService.setCurrentTime(30);
      component.skipBackward();
      expect(spy).toHaveBeenCalledWith(20);
    });
  });

  describe('progress bar handlers', () => {
    function mouseEventOnEl(el: HTMLElement, clientX: number): MouseEvent {
      vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        right: 100,
        bottom: 10,
        width: 100,
        height: 10,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect);
      const event = new MouseEvent('mousedown', { clientX });
      Object.defineProperty(event, 'currentTarget', { value: el });
      return event;
    }

    it('onProgressMouseDown starts dragging and seeks', () => {
      const spy = vi.spyOn(playerService, 'seek').mockImplementation(() => {});
      stateService.setDuration(100);
      const el = document.createElement('div');
      component.onProgressMouseDown(mouseEventOnEl(el, 50));
      expect(component.isDraggingProgress()).toBe(true);
      expect(spy).toHaveBeenCalledWith(50);
    });

    it('onProgressMouseMove seeks only while dragging', () => {
      const spy = vi.spyOn(playerService, 'seek').mockImplementation(() => {});
      stateService.setDuration(100);
      const el = document.createElement('div');

      component.onProgressMouseMove(mouseEventOnEl(el, 50));
      expect(spy).not.toHaveBeenCalled();

      component.isDraggingProgress.set(true);
      component.onProgressMouseMove(mouseEventOnEl(el, 50));
      expect(spy).toHaveBeenCalledWith(50);
    });

    it('onProgressMouseLeave ends the drag', () => {
      component.isDraggingProgress.set(true);
      component.onProgressMouseLeave();
      expect(component.isDraggingProgress()).toBe(false);
    });

    it('onProgressClick seeks to the clicked position', () => {
      const spy = vi.spyOn(playerService, 'seek').mockImplementation(() => {});
      stateService.setDuration(100);
      const el = document.createElement('div');
      component.onProgressClick(mouseEventOnEl(el, 25));
      expect(spy).toHaveBeenCalledWith(25);
    });

    it('onSeek converts the fractional position to seconds', () => {
      const spy = vi.spyOn(playerService, 'seek').mockImplementation(() => {});
      stateService.setDuration(200);
      component.onSeek(0.25);
      expect(spy).toHaveBeenCalledWith(50);
    });

    it('onDoubleClick toggles fullscreen', () => {
      const spy = vi.spyOn(component, 'toggleFullscreen').mockImplementation(() => {});
      component.onDoubleClick();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('settings handlers', () => {
    it('currentQuality reflects state', () => {
      stateService.setQuality('720p');
      expect(component.currentQuality).toBe('720p');
    });

    it('setPlaybackRate delegates and resets to main panel', () => {
      const spy = vi.spyOn(playerService, 'setPlaybackRate').mockImplementation(() => {});
      component.activeSettingsTab.set('speed');
      component.setPlaybackRate(1.5);
      expect(spy).toHaveBeenCalledWith(1.5);
      expect(component.activeSettingsTab()).toBe('main');
    });

    it('setQuality delegates and resets to main panel', () => {
      const spy = vi.spyOn(playerService, 'setQuality').mockImplementation(() => {});
      component.activeSettingsTab.set('quality');
      component.setQuality('1080p');
      expect(spy).toHaveBeenCalledWith('1080p');
      expect(component.activeSettingsTab()).toBe('main');
    });

    it('hasSettings is true when quality levels are available', () => {
      stateService.setAvailableQualities(['auto', '720p']);
      expect(component.hasSettings()).toBe(true);
    });

    it('hasSettings is true when subtitles are supported', () => {
      stateService.setSupportsSubtitles(true);
      expect(component.hasSettings()).toBe(true);
    });

    it('hasSettings is true for non-live content even without quality/subtitles', () => {
      stateService.setLive(false);
      expect(component.hasSettings()).toBe(true);
    });

    it('hasSettings is false for live content with no quality/subtitles', () => {
      stateService.setLive(true);
      expect(component.hasSettings()).toBe(false);
    });
  });

  describe('volume handlers', () => {
    it('setVolume mutes when volume drops to 0', () => {
      const volSpy = vi.spyOn(playerService, 'setVolume').mockImplementation(() => {});
      const muteSpy = vi.spyOn(playerService, 'setMuted').mockImplementation(() => {});
      stateService.setMuted(false);
      component.setVolume(0);
      expect(volSpy).toHaveBeenCalledWith(0);
      expect(muteSpy).toHaveBeenCalledWith(true);
    });

    it('setVolume unmutes when volume rises above 0 while muted', () => {
      const muteSpy = vi.spyOn(playerService, 'setMuted').mockImplementation(() => {});
      vi.spyOn(playerService, 'setVolume').mockImplementation(() => {});
      stateService.setMuted(true);
      component.setVolume(0.5);
      expect(muteSpy).toHaveBeenCalledWith(false);
    });

    it('setVolume does not touch mute state for a normal change', () => {
      const muteSpy = vi.spyOn(playerService, 'setMuted').mockImplementation(() => {});
      vi.spyOn(playerService, 'setVolume').mockImplementation(() => {});
      stateService.setMuted(false);
      component.setVolume(0.7);
      expect(muteSpy).not.toHaveBeenCalled();
    });

    it('onVolumeChange parses the input value and unmutes if needed', () => {
      const volSpy = vi.spyOn(playerService, 'setVolume').mockImplementation(() => {});
      const muteSpy = vi.spyOn(playerService, 'setMuted').mockImplementation(() => {});
      stateService.setMuted(true);

      const input = document.createElement('input');
      input.value = '0.6';
      component.onVolumeChange({ target: input } as unknown as Event);

      expect(volSpy).toHaveBeenCalledWith(0.6);
      expect(muteSpy).toHaveBeenCalledWith(false);
    });
  });

  describe('fullscreen', () => {
    it('toggleFullscreen requests fullscreen when not active', () => {
      const spy = vi.spyOn(playerService, 'requestFullscreen').mockImplementation(() => {});
      stateService.setFullscreen(false);
      component.toggleFullscreen();
      expect(spy).toHaveBeenCalled();
    });

    it('toggleFullscreen exits fullscreen when active', () => {
      const spy = vi.spyOn(playerService, 'exitFullscreen').mockImplementation(() => {});
      stateService.setFullscreen(true);
      component.toggleFullscreen();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('getVolumeIcon', () => {
    it('returns volume_off when muted', () => {
      stateService.setMuted(true);
      stateService.setVolume(0.8);
      expect(component.getVolumeIcon()).toBe('volume_off');
    });

    it('returns volume_off when volume is 0', () => {
      stateService.setMuted(false);
      stateService.setVolume(0);
      expect(component.getVolumeIcon()).toBe('volume_off');
    });

    it('returns volume_down for low volume', () => {
      stateService.setMuted(false);
      stateService.setVolume(0.2);
      expect(component.getVolumeIcon()).toBe('volume_down');
    });

    it('returns volume_up for higher volume', () => {
      stateService.setMuted(false);
      stateService.setVolume(0.8);
      expect(component.getVolumeIcon()).toBe('volume_up');
    });
  });

  describe('onDocumentClick', () => {
    it('closes the settings menu when the click is outside the settings component', () => {
      component.showSettingsMenu.set(true);
      component.activeSettingsTab.set('quality');

      const outside = document.createElement('div');
      document.body.appendChild(outside);
      const event = new MouseEvent('click');
      Object.defineProperty(event, 'target', { value: outside });

      component.onDocumentClick(event);

      expect(component.showSettingsMenu()).toBe(false);
      expect(component.activeSettingsTab()).toBe('main');
      outside.remove();
    });

    it('leaves the settings menu open when the click is inside it', () => {
      component.showSettingsMenu.set(true);

      const settingsEl = document.createElement('ngx-sp-settings-menu');
      const inner = document.createElement('span');
      settingsEl.appendChild(inner);
      document.body.appendChild(settingsEl);

      const event = new MouseEvent('click');
      Object.defineProperty(event, 'target', { value: inner });

      component.onDocumentClick(event);

      expect(component.showSettingsMenu()).toBe(true);
      settingsEl.remove();
    });
  });

  describe('hoverTime', () => {
    it('is null when hoverPercent is null', () => {
      expect(component.hoverTime()).toBeNull();
    });

    it('formats the time from hoverPercent and duration', () => {
      stateService.setDuration(120);
      component.hoverPercent.set(0.5);
      expect(component.hoverTime()).toBe('01:00');
    });
  });

  describe('playbackRates', () => {
    it('falls back to the default rate set when config omits playbackRates', () => {
      expect(component.playbackRates()).toEqual([0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]);
    });

    it('uses config.playbackRates when provided', () => {
      fixture.componentRef.setInput('config', { ...baseConfig, playbackRates: [1, 2] });
      fixture.detectChanges();
      expect(component.playbackRates()).toEqual([1, 2]);
    });
  });

  describe('showControls', () => {
    it('defaults every flag to true when controlsLayout is omitted', () => {
      const flags = component.showControls();
      expect(Object.values(flags).every(Boolean)).toBe(true);
    });

    it('hides a control when explicitly set to false in controlsLayout', () => {
      fixture.componentRef.setInput('config', {
        ...baseConfig,
        controlsLayout: { showVolume: false, showFullscreen: false },
      });
      fixture.detectChanges();
      const flags = component.showControls();
      expect(flags.volume).toBe(false);
      expect(flags.fullscreen).toBe(false);
      expect(flags.playPause).toBe(true);
    });
  });

  describe('template rendering', () => {
    it('renders the play/pause button with a data-testid', () => {
      const btn = fixture.nativeElement.querySelector('[data-testid="ngx-sp-play-pause"]');
      expect(btn).toBeTruthy();
    });

    it('hides skip buttons for live streams', () => {
      stateService.setLive(true);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[data-testid="ngx-sp-skip-back"]')).toBeNull();
    });

    it('shows the LIVE badge instead of the time display for live streams', () => {
      stateService.setLive(true);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.controls__live-badge')).toBeTruthy();
    });
  });
});
