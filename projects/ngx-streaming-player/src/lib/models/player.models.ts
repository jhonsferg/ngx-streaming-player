/**
 * @fileoverview Core model definitions for ngx-streaming-player.
 *
 * Exports all public-facing interfaces and types used across the library:
 * player configuration, state snapshots, event callbacks, visual theming,
 * subtitle tracks, and the adapter contract every protocol implementation
 * must fulfil.
 */

/**
 * Top-level configuration object accepted by `<ngx-sp-player [config]="…">`.
 *
 * Individual component inputs (e.g. `[src]`, `[autoplay]`) take precedence
 * over the matching fields in this object when both are supplied at the same
 * time - they are merged inside `resolvedConfig`.
 *
 * @example
 * // Minimal - only `src` is required
 * const config: PlayerConfig = {
 *   src: 'https://example.com/stream.m3u8',
 * };
 *
 * @example
 * // Full configuration
 * const config: PlayerConfig = {
 *   src: 'https://example.com/stream.m3u8',
 *   protocol: 'hls',
 *   poster: 'https://example.com/poster.jpg',
 *   autoplay: false,
 *   muted: false,
 *   volume: 0.8,
 *   playbackRates: [0.5, 1, 1.5, 2],
 *   enablePiP: true,
 *   enableKeyboard: true,
 *   controlsLayout: { autoHide: true, autoHideDelay: 3000 },
 *   theme: { primaryColor: '#E76F51', borderRadius: '12px' },
 * };
 */
export interface PlayerConfig {
  /**
   * Media source URL.  Auto-detection rules (when `protocol` is omitted):
   *
   * | URL pattern          | Protocol selected |
   * |----------------------|-------------------|
   * | contains `.m3u8`     | `hls`             |
   * | contains `.mpd`      | `dash`            |
   * | contains `youtube.com` / `youtu.be` | `youtube` |
   * | anything else        | `native`          |
   */
  src: string;

  /**
   * Explicitly forces a specific streaming protocol / adapter.
   * Omit to let the player auto-detect from the `src` URL.
   *
   * @see {@link IPlayerAdapter} for the adapter contract.
   */
  protocol?: 'hls' | 'dash' | 'native' | 'youtube';

  /**
   * URL of a poster image displayed before the first frame loads.
   * Has no effect on YouTube sources (the platform controls the thumbnail).
   */
  poster?: string;

  /**
   * Start playback automatically once the source is ready.
   * Most browsers require `muted: true` for autoplay to be permitted.
   * @default false
   */
  autoplay?: boolean;

  /**
   * Start the player in a muted state.
   * @default false
   */
  muted?: boolean;

  /**
   * Show the browser's native `<video>` controls instead of the
   * custom `<ngx-sp-player-controls>` UI.
   * @default false
   */
  controls?: boolean;

  /**
   * Initial audio volume in the range `[0, 1]`.
   * @default 1
   */
  volume?: number;

  /**
   * Playback-speed options presented in the settings menu.
   * @default [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]
   */
  playbackRates?: number[];

  /**
   * Show the Picture-in-Picture toggle button.
   * Automatically disabled for YouTube sources because the iframe API
   * does not expose the browser PiP API.
   * @default true
   */
  enablePiP?: boolean;

  /**
   * Enable keyboard shortcuts on `window:keydown`.
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
   * @default true
   */
  enableKeyboard?: boolean;

  /**
   * Granular visibility and auto-hide settings for the controls bar.
   * @see {@link PlayerControlsLayout}
   */
  controlsLayout?: PlayerControlsLayout;

  /**
   * CSS custom-property overrides applied to the player container.
   * @see {@link PlayerTheme}
   */
  theme?: PlayerTheme;
}

/**
 * Granular visibility and auto-hide settings for the controls bar.
 *
 * Every field defaults to `true` / enabled when omitted.
 *
 * @example
 * // Minimal bar - only play/pause and fullscreen visible
 * const layout: PlayerControlsLayout = {
 *   showVolume: false,
 *   showProgress: false,
 *   showTime: false,
 *   showSettings: false,
 * };
 *
 * @example
 * // Disable auto-hide entirely
 * const layout: PlayerControlsLayout = { autoHide: false };
 */
export interface PlayerControlsLayout {
  /** Show the play / pause toggle button. @default true */
  showPlayPause?: boolean;
  /** Show the volume slider and mute button. @default true */
  showVolume?: boolean;
  /** Show the seekable progress bar. @default true */
  showProgress?: boolean;
  /** Show the current-time / duration display. @default true */
  showTime?: boolean;
  /** Expose the playback-speed row in the settings menu. @default true */
  showSpeed?: boolean;
  /** Expose the quality-level row in the settings menu. @default true */
  showQuality?: boolean;
  /** Show the fullscreen toggle button. @default true */
  showFullscreen?: boolean;
  /** Show the Picture-in-Picture toggle button. @default true */
  showPiP?: boolean;
  /** Show the settings (gear) menu button. @default true */
  showSettings?: boolean;
  /**
   * Fade the controls bar out while the video plays and the cursor is idle.
   * @default true
   */
  autoHide?: boolean;
  /**
   * Milliseconds of cursor inactivity before the controls hide.
   * Only effective when `autoHide` is `true`.
   * @default 3000
   */
  autoHideDelay?: number;
}

/**
 * CSS custom-property overrides for the player's visual theme.
 *
 * Values are applied directly on the player container element via
 * `element.style.setProperty()`, so multiple players on the same page
 * can carry independent themes without global CSS pollution.
 *
 * @example
 * const theme: PlayerTheme = {
 *   primaryColor: '#E76F51',
 *   secondaryColor: '#2A9D8F',
 *   accentColor:   '#F4A261',
 *   backgroundColor: 'rgba(0,0,0,0.85)',
 *   borderRadius:  '12px',
 *   controlSize:   '40px',
 * };
 */
export interface PlayerTheme {
  /** `--ngx-sp-primary` - progress-bar fill and active-state highlight. */
  primaryColor?: string;
  /** `--ngx-sp-secondary` - secondary interactive elements. */
  secondaryColor?: string;
  /** `--ngx-sp-accent` - hover highlights and tooltip backgrounds. */
  accentColor?: string;
  /** `--ngx-sp-bg-dark` - controls bar background. */
  backgroundColor?: string;
  /** `--ngx-sp-text-light` - icon and label colour. */
  textColor?: string;
  /** `--ngx-sp-radius` - border-radius of the player container. */
  borderRadius?: string;
  /** `--ngx-sp-control-size` - width and height of icon buttons. */
  controlSize?: string;
}

/**
 * Represents a single subtitle or caption track detected by an adapter.
 *
 * Track identifiers are adapter-specific:
 * - **NativeAdapter** - numeric index into `HTMLVideoElement.textTracks`.
 * - **HlsAdapter** - numeric `id` from the HLS.js subtitle track object.
 * - **DashAdapter** - the `id` string from the dash.js text-track object.
 * - **YouTubeAdapter** - the BCP-47 language code (e.g. `'en'`, `'es'`).
 *
 * @example
 * const track: SubtitleTrack = {
 *   id: 'en',
 *   label: 'English',
 *   language: 'en',
 * };
 */
export interface SubtitleTrack {
  /**
   * Adapter-specific unique identifier passed to
   * `PlayerService.setSubtitle()` / `NgxPlayerControlService.setSubtitle()`.
   */
  id: string | number;
  /** Human-readable name displayed in the subtitles sub-menu. */
  label: string;
  /** BCP-47 language tag (e.g. `'en'`, `'fr'`, `'pt-BR'`). */
  language: string;
}

/**
 * Immutable snapshot of the complete player state.
 *
 * Emitted via the `stateChange` output on every change and also accessible
 * as a reactive computed signal through `PlayerStateService.state()`.
 */
export interface PlayerState {
  /** `true` while the media is actively playing. */
  isPlaying: boolean;
  /** `true` while the player is stalled waiting for data to buffer. */
  isBuffering: boolean;
  /** Current playback position in seconds. */
  currentTime: number;
  /** Total media duration in seconds. `Infinity` for live/unbounded streams. */
  duration: number;
  /** Current volume level in the range `[0, 1]`. */
  volume: number;
  /** Whether audio output is muted. */
  muted: boolean;
  /** Active playback rate (1 = normal speed). */
  playbackRate: number;
  /**
   * Human-readable label of the active quality level
   * (e.g. `'1080p'`, `'720p'`, `'auto'`).
   */
  quality: string;
  /** All quality labels available for the current source. */
  availableQualities: string[];
  /** Whether the player is currently in browser fullscreen mode. */
  isFullscreen: boolean;
  /** Whether the player is currently in Picture-in-Picture mode. */
  isPiP: boolean;
  /** `true` when the active adapter is `YouTubeAdapter`. */
  isYouTube: boolean;
  /** `true` when the source is a live / unbounded stream. */
  isLive: boolean;
  /** Whether subtitles or captions are currently rendering. */
  subtitlesEnabled: boolean;
  /** `true` when the media has reached its natural end. */
  isEnded: boolean;
  /** Last error object or message; `null` when no error has occurred. */
  error: any | null;
}

/**
 * Callback-style event handlers that mirror the player's lifecycle events.
 *
 * Pass this object via `[events]="myHandlers"` on `<ngx-sp-player>` as an
 * alternative to Angular output bindings when a plain-object approach is
 * preferred (e.g. when using the player inside a non-Angular context or a
 * wrapper component).
 *
 * @example
 * const events: PlayerEvents = {
 *   onPlay:       () => analytics.track('play'),
 *   onTimeUpdate: (t) => progressBar.value = t,
 *   onError:      (err) => logger.error('Player error', err),
 * };
 */
export interface PlayerEvents {
  /** Called when playback starts or resumes after a pause. */
  onPlay?: () => void;
  /** Called when playback is paused by the user or programmatically. */
  onPause?: () => void;
  /** Called when the media reaches its natural end. */
  onEnded?: () => void;
  /**
   * Called periodically (≈ 250 ms) with the current playback position.
   * @param time - Current position in seconds.
   */
  onTimeUpdate?: (time: number) => void;
  /**
   * Called whenever the volume level or mute state changes.
   * @param volume - New volume level in the range `[0, 1]`.
   */
  onVolumeChange?: (volume: number) => void;
  /**
   * Called when the playback rate changes.
   * @param rate - New playback rate (1 = normal speed).
   */
  onPlaybackRateChange?: (rate: number) => void;
  /**
   * Called when the active quality level changes.
   * @param quality - Human-readable quality label (e.g. `'1080p'`, `'auto'`).
   */
  onQualityChange?: (quality: string) => void;
  /**
   * Called when the player enters or exits fullscreen.
   * @param isFullscreen - `true` on enter, `false` on exit.
   */
  onFullscreenChange?: (isFullscreen: boolean) => void;
  /**
   * Called when the player enters or exits Picture-in-Picture.
   * @param isPiP - `true` on enter, `false` on exit.
   */
  onPiPChange?: (isPiP: boolean) => void;
  /**
   * Called when the total media duration is first determined or changes.
   * @param duration - Duration in seconds.
   */
  onDurationChange?: (duration: number) => void;
  /**
   * Called when the buffering state transitions.
   * @param buffering - `true` when buffering starts, `false` when it ends.
   */
  onBufferingChange?: (buffering: boolean) => void;
  /**
   * Called when the active subtitle track changes.
   * @param id - The track ID that was activated, or `null` when subtitles are disabled.
   */
  onSubtitleChange?: (id: string | number | null) => void;
  /**
   * Called when a recoverable or fatal error occurs.
   * @param error - Underlying error object or descriptive string.
   */
  onError?: (error: any) => void;
}

/**
 * Contract that every streaming-protocol adapter must implement.
 *
 * An adapter encapsulates all protocol-specific logic (source loading,
 * native-event mapping, quality/subtitle switching) and exposes a uniform
 * API consumed exclusively by `PlayerService`. This makes it straightforward
 * to add support for new protocols without modifying the core player logic.
 *
 * Adapters are **not** Angular services (except `YouTubeAdapter`, which needs
 * DI for `PlayerStateService`). They are plain classes instantiated by
 * `PlayerService.createAdapter()` and destroyed on hot-swap or component
 * teardown.
 *
 * @example
 * // Minimal custom adapter skeleton
 * export class MyCustomAdapter implements IPlayerAdapter {
 *   private _ready = false;
 *
 *   constructor(
 *     private readonly el: HTMLVideoElement,
 *     private readonly state: PlayerStateService,
 *   ) {}
 *
 *   initialize(config: PlayerConfig): void {
 *     this.el.src = config.src;
 *     this.el.addEventListener('canplay', () => this._ready = true, { once: true });
 *   }
 *
 *   play(): Promise<void>  { return this.el.play(); }
 *   pause(): void          { this.el.pause(); }
 *   seek(t: number): void  { this.el.currentTime = t; }
 *   setVolume(v: number): void { this.el.volume = v; }
 *   setMuted(m: boolean): void { this.el.muted = m; }
 *   setPlaybackRate(r: number): void { this.el.playbackRate = r; }
 *   setQuality(_: string): void  { }
 *   setSubtitle(_: string | number | null): void { }
 *   isReady(): boolean { return this._ready; }
 *   destroy(): void    { this.el.src = ''; }
 * }
 */
export interface IPlayerAdapter {
  /**
   * Initialises the adapter: attaches the media source, configures the
   * underlying player library, and registers all internal event listeners.
   *
   * Called **once** per adapter lifecycle. For hot-swap a new adapter
   * instance is created instead of calling `initialize` again.
   *
   * @param config - Fully resolved player configuration.
   */
  initialize(config: PlayerConfig): void;

  /**
   * Starts or resumes media playback.
   *
   * @returns A Promise that resolves when playback begins, or rejects if
   *   blocked by the browser's autoplay policy. YouTube adapters always
   *   return a resolved Promise since the IFrame API does not expose one.
   */
  play(): Promise<void>;

  /** Pauses playback without changing the current position. */
  pause(): void;

  /**
   * Seeks to the specified playback position.
   *
   * @param time - Target position in seconds. Values outside `[0, duration]`
   *   are silently clamped by the underlying implementation.
   */
  seek(time: number): void;

  /**
   * Sets the audio volume level.
   *
   * @param volume - Desired volume in the range `[0, 1]`. Values are clamped
   *   by each adapter before being passed to the underlying API.
   */
  setVolume(volume: number): void;

  /**
   * Mutes or unmutes audio without altering the stored volume level.
   *
   * @param muted - `true` to mute, `false` to unmute.
   */
  setMuted(muted: boolean): void;

  /**
   * Changes the playback speed multiplier.
   *
   * @param rate - Desired rate (e.g. `0.5` for half speed, `2` for double).
   */
  setPlaybackRate(rate: number): void;

  /**
   * Switches to the specified quality level.
   *
   * Adapters that do not support quality switching (e.g. `NativeAdapter`)
   * **must** implement this as a no-op - never throw.
   *
   * @param quality - Quality label string as surfaced by
   *   `PlayerStateService.availableQualities()`, or `'auto'` to re-enable
   *   adaptive bitrate selection.
   */
  setQuality(quality: string): void;

  /**
   * Activates a subtitle / caption track, or disables subtitles entirely.
   *
   * Adapters without subtitle support **must** implement this as a no-op.
   *
   * @param id - Identifier from `SubtitleTrack.id` to activate the track,
   *   or `null` to disable all subtitles.
   */
  setSubtitle(id: string | number | null): void;

  /**
   * Returns `true` once the adapter has finished initialising and is ready
   * to accept playback commands.
   */
  isReady(): boolean;

  /**
   * Tears down the adapter: stops playback, destroys the underlying player
   * instance, and removes all event listeners.
   *
   * Called by `PlayerService` before a hot-swap and during component
   * destruction. Implementations must be idempotent - calling `destroy()`
   * on an already-destroyed adapter must not throw.
   */
  destroy(): void;
}
