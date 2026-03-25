/**
 * @fileoverview Main entry-point component for ngx-streaming-player.
 *
 * Re-exports nothing — this file contains only the `StreamingPlayerComponent`
 * class. Import from `ngx-streaming-player` (the public API barrel) instead
 * of from this path directly.
 */

import {
  Component,
  ViewChild,
  ElementRef,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ChangeDetectionStrategy,
  signal,
  effect,
  computed,
  HostListener,
  inject,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlayerConfig, PlayerEvents, PlayerState, PlayerTheme } from '../../models/player.models';
import { PlayerService } from '../../services/player.service';
import { PlayerStateService } from '../../services/player-state.service';
import { NgxPlayerControlService } from '../../services/ngx-player-control.service';
import { YouTubeAdapter } from '../../adapters/youtube/youtube.adapter';
import { PlayerControlsComponent } from '../player-controls/player-controls.component';

/**
 * Main streaming player component — the only element a consumer needs to add
 * to a template to embed a fully-featured video player.
 *
 * `StreamingPlayerComponent` orchestrates three sub-systems:
 * - **Adapter selection** — delegates protocol detection and media loading to
 *   `PlayerService`, which creates the appropriate `IPlayerAdapter`.
 * - **Reactive state** — all UI signals (`showControls`, `isHovering`,
 *   `showRipple`) are Angular `signal()` instances updated in response to
 *   user interactions.
 * - **Public API** — exposes `play()`, `pause()`, `seek()`, `load()`,
 *   `toggleFullscreen()`, and `togglePiP()` for imperative control via
 *   `@ViewChild`.  The same capabilities are also available globally via
 *   `NgxPlayerControlService`.
 *
 * ### Inputs
 * Pass configuration either via the unified `[config]` input or via
 * individual shorthand inputs (`[src]`, `[autoplay]`, …). Individual inputs
 * always override their `config` counterparts.
 *
 * ### Hot-swap
 * Changing `[src]` or calling `load()` at runtime replaces the media source
 * without recreating the component. Volume and mute state are preserved.
 *
 * ### Multiple players
 * Assign a unique `[playerId]` to each `<ngx-sp-player>` when using more
 * than one player on the same page.  `NgxPlayerControlService` uses this ID
 * to route commands to the correct instance.
 *
 * @example
 * <!-- Minimal usage -->
 * <ngx-sp-player src="https://example.com/video.mp4"></ngx-sp-player>
 *
 * @example
 * <!-- Full configuration object -->
 * <ngx-sp-player
 *   [config]="playerConfig"
 *   (ready)="onReady()"
 *   (stateChange)="onStateChange($event)"
 *   (playerError)="onError($event)"
 * ></ngx-sp-player>
 *
 * @example
 * <!-- Multiple players with individual IDs -->
 * <ngx-sp-player playerId="cam1" [src]="cam1Url"></ngx-sp-player>
 * <ngx-sp-player playerId="cam2" [src]="cam2Url"></ngx-sp-player>
 *
 * @example
 * <!-- Programmatic control via ViewChild -->
 * @ViewChild(StreamingPlayerComponent) player!: StreamingPlayerComponent;
 *
 * ngAfterViewInit() {
 *   this.player.play();
 *   this.player.seek(60);
 *   this.player.load('https://example.com/new-source.m3u8');
 * }
 */
@Component({
  selector: 'ngx-sp-player',
  standalone: true,
  imports: [CommonModule, PlayerControlsComponent],
  templateUrl: './streaming-player.component.html',
  styleUrls: ['./streaming-player.component.scss'],
  providers: [PlayerService, PlayerStateService, YouTubeAdapter],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StreamingPlayerComponent implements OnInit, AfterViewInit, OnDestroy {
  /** Reference to the native `<video>` element used for non-YouTube sources. */
  @ViewChild('videoElement', { static: true }) videoElementRef!: ElementRef<HTMLVideoElement>;

  /** Reference to the outermost container div, used for fullscreen requests and theming. */
  @ViewChild('playerContainer', { static: true }) containerRef!: ElementRef<HTMLDivElement>;

  /** Reference to the container div into which the YouTube `<iframe>` is injected. */
  @ViewChild('youtubeContainer', { static: true }) youtubeContainerRef!: ElementRef<HTMLDivElement>;

  // -- Inputs -----------------------------------------------------------------

  /**
   * Full configuration object.  Individual shorthand inputs override the
   * corresponding fields inside this object when both are provided.
   *
   * @see {@link PlayerConfig}
   */
  config = input<PlayerConfig>();

  /**
   * Media source URL (shorthand for `config.src`).
   * Accepts HLS (`.m3u8`), DASH (`.mpd`), native (`.mp4`, …), or YouTube URLs.
   */
  src = input<string>();

  /**
   * Start playback automatically after the source loads (shorthand for
   * `config.autoplay`). Most browsers require `[muted]="true"` for
   * autoplay without user interaction.
   */
  autoplay = input<boolean>();

  /**
   * Start in a muted state (shorthand for `config.muted`).
   */
  muted = input<boolean>();

  /**
   * Initial audio volume in `[0, 1]` (shorthand for `config.volume`).
   */
  volume = input<number>();

  /**
   * Poster image URL shown before the first frame loads
   * (shorthand for `config.poster`).
   */
  poster = input<string>();

  /**
   * Visual theme overrides applied as CSS custom properties on the container
   * (shorthand for `config.theme`).
   *
   * @see {@link PlayerTheme}
   */
  theme = input<PlayerTheme>();

  /**
   * Unique identifier for this player instance.
   *
   * Required only when multiple `<ngx-sp-player>` elements exist on the same
   * page and need independent control via `NgxPlayerControlService`.
   *
   * @default 'default'
   */
  playerId = input<string>('default');

  /**
   * Callback-style event handlers as an alternative to Angular output bindings.
   *
   * @see {@link PlayerEvents}
   */
  events = input<PlayerEvents>();

  // -- Outputs ----------------------------------------------------------------

  /**
   * Emitted once after the player and its active adapter are fully initialised
   * and ready to accept playback commands.
   */
  ready = output<void>();

  /**
   * Emitted on every state change (play, pause, seek, volume, quality, …).
   * Carries a complete `PlayerState` snapshot.
   *
   * @see {@link PlayerState}
   */
  stateChange = output<PlayerState>();

  /**
   * Emitted when the active adapter reports a recoverable or fatal error.
   * The payload is the raw error object or string from the underlying library.
   */
  playerError = output<any>();

  // -- UI state signals --------------------------------------------------------

  /**
   * Whether the controls bar is currently visible.
   * Set to `false` after the auto-hide delay when the video is playing and
   * the cursor is idle.
   */
  readonly showControls = signal(true);

  /**
   * Whether the cursor is currently inside the player container.
   * Used as a guard in the auto-hide timer to prevent hiding while hovering.
   */
  readonly isHovering = signal(false);

  /**
   * State for the seek-ripple animation shown on double-click or keyboard seek.
   * `active` triggers the CSS animation; `side` determines the left/right position.
   */
  readonly showRipple = signal<{ active: boolean; side: 'left' | 'right' }>({
    active: false,
    side: 'left',
  });

  // -- Private fields ---------------------------------------------------------

  /** Timer ID for the seek-ripple auto-dismiss timeout. */
  private rippleTimeout: any;

  /** Timer ID for the controls auto-hide timeout. */
  private controlsTimeout: any;

  /** Default auto-hide delay in milliseconds when `controlsLayout.autoHideDelay` is unset. */
  private readonly AUTO_HIDE_DELAY = 3000;

  /**
   * Guard that prevents the hot-swap `effect` from triggering on the very
   * first render (before `ngAfterViewInit` has set `lastLoadedSrc`).
   */
  private initialized = false;

  /**
   * Tracks the last `src` value that was passed to `loadSource()` so the
   * hot-swap `effect` can skip a source that is already loaded and avoid
   * double-initialisation on the first change-detection cycle.
   */
  private lastLoadedSrc = '';

  // -- Injected services ------------------------------------------------------

  /** @internal Core service that manages the active adapter lifecycle. */
  readonly playerService = inject(PlayerService);

  /** @internal Reactive state service for this player instance. */
  readonly stateService = inject(PlayerStateService);

  /** @internal Global control service used to register / unregister this player. */
  private readonly controlService = inject(NgxPlayerControlService);

  // -- Computed signals --------------------------------------------------------

  /**
   * Merges the `config` input with all individual shorthand inputs.
   *
   * Individual inputs take precedence over matching fields in the `config`
   * object. This is the single source of truth used by `PlayerService` and
   * the controls component.
   *
   * @example
   * // config = { src: 'a.m3u8', volume: 0.5 }
   * // [volume]="0.8"
   * // → resolvedConfig.volume === 0.8  (shorthand wins)
   */
  readonly resolvedConfig = computed<PlayerConfig>(() => {
    const base = this.config() ?? ({} as PlayerConfig);
    const resolved: PlayerConfig = { ...base };

    const src = this.src();
    if (src !== undefined) resolved.src = src;

    const autoplay = this.autoplay();
    if (autoplay !== undefined) resolved.autoplay = autoplay;

    const muted = this.muted();
    if (muted !== undefined) resolved.muted = muted;

    const volume = this.volume();
    if (volume !== undefined) resolved.volume = volume;

    const poster = this.poster();
    if (poster !== undefined) resolved.poster = poster;

    const theme = this.theme();
    if (theme !== undefined) resolved.theme = theme;

    return resolved;
  });

  // -- Constructor -------------------------------------------------------------

  constructor() {
    // Forward every state-change snapshot to the `stateChange` output.
    effect(() => {
      const state = this.stateService.state();
      this.stateChange.emit(state);
    });

    // Forward errors to the `error` output.
    effect(() => {
      const err = this.stateService.error();
      if (err) this.playerError.emit(err);
    });

    // Hot-swap: reload when src changes after initial load.
    // Guards against double-load: ngAfterViewInit sets lastLoadedSrc before
    // this effect can run (both happen in the same first CD flush).
    effect(() => {
      const cfg = this.resolvedConfig();
      if (!this.initialized || cfg.src === this.lastLoadedSrc) return;
      this.lastLoadedSrc = cfg.src;
      this.playerService.loadSource(cfg.src, cfg);
    });
  }

  // -- Lifecycle hooks ---------------------------------------------------------

  /**
   * Validates that a media source has been provided.
   *
   * @throws {Error} When neither `[src]` nor `[config].src` is supplied.
   */
  ngOnInit(): void {
    const cfg = this.resolvedConfig();
    if (!cfg.src) {
      throw new Error(
        '[ngx-sp-player] A source is required. Provide [config] with src, or the [src] input.',
      );
    }
  }

  /**
   * Initialises the player after the view is ready.
   *
   * Steps:
   * 1. Sets `lastLoadedSrc` **before** `initialized = true` so the hot-swap
   *    effect (which runs in the same CD flush) sees the initial source as
   *    already loaded and does not fire a second `loadSource()`.
   * 2. Initialises `PlayerService` with the video element, container, and
   *    YouTube container references.
   * 3. Registers this instance with `NgxPlayerControlService`.
   * 4. Attaches `fullscreenchange` and PiP document-level event listeners.
   * 5. Emits the `ready` output.
   */
  ngAfterViewInit(): void {
    const cfg = this.resolvedConfig();
    this.lastLoadedSrc = cfg.src;
    this.playerService.initialize(this.videoElementRef.nativeElement, cfg);
    this.playerService.setContainer(this.containerRef.nativeElement);
    this.playerService.setYouTubeContainer(this.youtubeContainerRef.nativeElement);
    this.initialized = true;

    this.controlService._register(this.playerId(), this.playerService, this.stateService);

    document.addEventListener('fullscreenchange', this.onFullscreenChange);
    if ('pictureInPictureElement' in document) {
      document.addEventListener('enterpictureinpicture', this.onPiPChange);
      document.addEventListener('leavepictureinpicture', this.onPiPChange);
    }

    this.ready.emit();
  }

  /**
   * Cleans up all resources when the component is destroyed.
   *
   * - Unregisters from `NgxPlayerControlService`.
   * - Destroys the active adapter via `PlayerService.destroy()`.
   * - Removes fullscreen and PiP document-level event listeners.
   * - Clears pending timeouts to prevent memory leaks.
   */
  ngOnDestroy(): void {
    this.controlService._unregister(this.playerId());
    this.playerService.destroy();

    document.removeEventListener('fullscreenchange', this.onFullscreenChange);
    if ('pictureInPictureElement' in document) {
      document.removeEventListener('enterpictureinpicture', this.onPiPChange);
      document.removeEventListener('leavepictureinpicture', this.onPiPChange);
    }

    if (this.controlsTimeout) clearTimeout(this.controlsTimeout);
    if (this.rippleTimeout) clearTimeout(this.rippleTimeout);
  }

  // -- Template event handlers -------------------------------------------------

  /**
   * Toggles play / pause on a single click of the video area.
   */
  onVideoClick(): void {
    if (this.stateService.isPlaying()) {
      this.playerService.pause();
    } else {
      this.playerService.play();
    }
  }

  /**
   * Seeks ±10 seconds on a double-click, split by the horizontal centre of
   * the video. Triggers the seek-ripple animation on the appropriate side.
   *
   * @param event - The native `MouseEvent` from the double-click.
   */
  onVideoDoubleClick(event: MouseEvent): void {
    const videoWidth = this.videoElementRef.nativeElement.offsetWidth;
    const clickX = event.offsetX;

    if (clickX < videoWidth / 2) {
      const newTime = Math.max(0, this.stateService.currentTime() - 10);
      this.playerService.seek(newTime);
      this.triggerRipple('left');
    } else {
      const newTime = Math.min(this.stateService.duration(), this.stateService.currentTime() + 10);
      this.playerService.seek(newTime);
      this.triggerRipple('right');
    }
  }

  /**
   * Activates the seek-ripple animation for 500 ms on the given side.
   *
   * An existing timeout is always cleared before starting a new one so that
   * rapid consecutive seeks do not stack ripple timers.
   *
   * @param side - Which half of the player to show the ripple on.
   */
  private triggerRipple(side: 'left' | 'right'): void {
    if (this.rippleTimeout) clearTimeout(this.rippleTimeout);
    this.showRipple.set({ active: true, side });
    this.rippleTimeout = setTimeout(() => {
      this.showRipple.set({ active: false, side });
    }, 500);
  }

  /**
   * Shows the controls bar and resets the auto-hide timer while the cursor
   * moves over the player.
   *
   * Auto-hide is only scheduled when:
   * - `controlsLayout.autoHide` is not explicitly `false`, and
   * - the video is currently playing.
   *
   * The controls stay visible if the cursor remains inside the player
   * (`isHovering` guard in the timeout callback).
   */
  onMouseMove(): void {
    this.isHovering.set(true);
    this.showControls.set(true);

    const cfg = this.resolvedConfig();
    if (cfg.controlsLayout?.autoHide !== false && this.stateService.isPlaying()) {
      if (this.controlsTimeout) clearTimeout(this.controlsTimeout);
      const delay = cfg.controlsLayout?.autoHideDelay || this.AUTO_HIDE_DELAY;
      this.controlsTimeout = setTimeout(() => {
        if (this.stateService.isPlaying() && !this.isHovering()) {
          this.showControls.set(false);
        }
      }, delay);
    }
  }

  /**
   * Clears the hovering flag when the cursor leaves the player boundary.
   * Does **not** immediately hide the controls — the auto-hide timer handles that.
   */
  onMouseLeave(): void {
    this.isHovering.set(false);
  }

  /**
   * Syncs fullscreen state from the `fullscreenchange` document event.
   * Stored as an arrow function so it can be passed to `addEventListener`
   * and `removeEventListener` with a stable reference.
   */
  private onFullscreenChange = (): void => {
    this.stateService.setFullscreen(!!document.fullscreenElement);
  };

  /**
   * Syncs PiP state from the `enterpictureinpicture` / `leavepictureinpicture`
   * document events. Stored as an arrow function for stable listener reference.
   */
  private onPiPChange = (): void => {
    this.stateService.setPiP(!!(document as any).pictureInPictureElement);
  };

  /**
   * Handles keyboard shortcuts on the `window:keydown` event.
   *
   * Shortcuts are disabled when:
   * - `enableKeyboard` is `false` in the resolved config.
   * - The event target is an `<input>` or `<textarea>` element.
   *
   * | Key           | Action                     |
   * |---------------|----------------------------|
   * | `Space` / `K` | Play / Pause               |
   * | `J`           | Seek −10 s                 |
   * | `L`           | Seek +10 s                 |
   * | `←`           | Seek −5 s                  |
   * | `→`           | Seek +5 s                  |
   * | `↑`           | Volume +10 %               |
   * | `↓`           | Volume −10 %               |
   * | `M`           | Toggle mute                |
   * | `F`           | Toggle fullscreen          |
   * | `I`           | Toggle Picture-in-Picture  |
   * | `C`           | Toggle subtitles           |
   *
   * @param event - The native `KeyboardEvent` from the window.
   */
  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (this.resolvedConfig().enableKeyboard === false) return;

    const target = event.target as HTMLElement;
    if (target.tagName.toLowerCase() === 'input' || target.tagName.toLowerCase() === 'textarea')
      return;

    switch (event.code) {
      case 'Space':
        event.preventDefault();
        if (this.stateService.isPlaying()) {
          this.playerService.pause();
        } else {
          this.playerService.play();
        }
        this.showControls.set(true);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        this.playerService.seek(Math.max(0, this.stateService.currentTime() - 5));
        this.triggerRipple('left');
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.playerService.seek(
          Math.min(this.stateService.duration(), this.stateService.currentTime() + 5),
        );
        this.triggerRipple('right');
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.playerService.setVolume(Math.min(1, this.stateService.volume() + 0.1));
        if (this.stateService.muted() && this.stateService.volume() > 0) {
          this.playerService.setMuted(false);
        }
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.playerService.setVolume(Math.max(0, this.stateService.volume() - 0.1));
        break;
      case 'KeyK':
        event.preventDefault();
        if (this.stateService.isPlaying()) {
          this.playerService.pause();
        } else {
          this.playerService.play();
        }
        this.showControls.set(true);
        break;
      case 'KeyJ':
        event.preventDefault();
        this.playerService.seek(Math.max(0, this.stateService.currentTime() - 10));
        this.triggerRipple('left');
        break;
      case 'KeyL':
        event.preventDefault();
        this.playerService.seek(
          Math.min(this.stateService.duration(), this.stateService.currentTime() + 10),
        );
        this.triggerRipple('right');
        break;
      case 'KeyF':
        event.preventDefault();
        this.toggleFullscreen();
        break;
      case 'KeyM':
        event.preventDefault();
        this.playerService.setMuted(!this.stateService.muted());
        break;
      case 'KeyI':
        event.preventDefault();
        this.togglePiP();
        break;
      case 'KeyC':
        event.preventDefault();
        this.playerService.toggleSubtitles();
        break;
    }
  }

  // -- Public component API (accessible via @ViewChild) ----------------------

  /**
   * Starts or resumes playback.
   *
   * @returns A Promise that resolves when playback begins.
   *
   * @example
   * @ViewChild(StreamingPlayerComponent) player!: StreamingPlayerComponent;
   * this.player.play();
   */
  play(): Promise<void> {
    return this.playerService.play();
  }

  /**
   * Pauses playback.
   *
   * @example
   * this.player.pause();
   */
  pause(): void {
    this.playerService.pause();
  }

  /**
   * Seeks to the specified position.
   *
   * @param time - Target position in seconds.
   *
   * @example
   * this.player.seek(120); // jump to 2:00
   */
  seek(time: number): void {
    this.playerService.seek(time);
  }

  /**
   * Sets the audio volume.
   *
   * @param volume - Volume level in the range `[0, 1]`.
   *
   * @example
   * this.player.setVolume(0.5);
   */
  setVolume(volume: number): void {
    this.playerService.setVolume(volume);
  }

  /**
   * Changes the playback speed.
   *
   * @param rate - Desired rate (e.g. `1.5`, `2`).
   *
   * @example
   * this.player.setPlaybackRate(1.5);
   */
  setPlaybackRate(rate: number): void {
    this.playerService.setPlaybackRate(rate);
  }

  /**
   * Hot-swaps the media source programmatically.
   *
   * This method is also available globally via
   * `NgxPlayerControlService.load()`. The `lastLoadedSrc` guard is updated
   * before calling `loadSource()` to prevent the hot-swap `effect` from
   * firing a redundant second load.
   *
   * @param src - New media source URL.
   * @param config - Optional partial config overrides for the new source.
   *
   * @example
   * this.player.load('https://example.com/new-stream.m3u8', { autoplay: true });
   */
  load(src: string, config?: Partial<PlayerConfig>): void {
    this.lastLoadedSrc = src;
    this.playerService.loadSource(src, config);
  }

  /**
   * Toggles the browser fullscreen mode.
   * Requests fullscreen when not in fullscreen; exits otherwise.
   *
   * @example
   * this.player.toggleFullscreen();
   */
  toggleFullscreen(): void {
    if (this.stateService.isFullscreen()) {
      this.playerService.exitFullscreen();
    } else {
      this.playerService.requestFullscreen();
    }
  }

  /**
   * Toggles Picture-in-Picture mode.
   * Requests PiP when not in PiP; exits otherwise.
   *
   * Has no effect on YouTube sources (PiP is not supported via the IFrame API).
   *
   * @example
   * this.player.togglePiP();
   */
  togglePiP(): void {
    if (this.stateService.isPiP()) {
      this.playerService.exitPiP();
    } else {
      this.playerService.requestPiP();
    }
  }
}
