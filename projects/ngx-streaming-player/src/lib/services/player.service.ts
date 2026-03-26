import { Injectable, inject } from '@angular/core';
import { PlayerStateService } from './player-state.service';
import { YouTubeAdapter } from '../adapters/youtube/youtube.adapter';
import { HlsAdapter } from '../adapters/hls/hls.adapter';
import { DashAdapter } from '../adapters/dash/dash.adapter';
import { NativeAdapter } from '../adapters/native/native.adapter';
import { IPlayerAdapter, PlayerConfig, PlayerTheme } from '../models/player.models';

/**
 * Core orchestrator that bridges the player component and the protocol
 * adapters.
 *
 * `PlayerService` is responsible for:
 * - **Adapter lifecycle** - detecting the streaming protocol, creating the
 *   correct adapter, initialising it, and destroying it on hot-swap or
 *   component teardown.
 * - **Theme application** - converting `PlayerTheme` fields to CSS custom
 *   properties set on the container element.
 * - **Unified playback API** - delegating `play`, `pause`, `seek`, volume,
 *   muted, playback rate, quality, subtitle, fullscreen, and PiP commands to
 *   the currently active adapter.
 * - **Hot-swap** - replacing the source at runtime without recreating the
 *   Angular component tree (see {@link loadSource}).
 *
 * ### Provided scope
 * `PlayerService` is declared in `StreamingPlayerComponent.providers` so that
 * each `<ngx-sp-player>` instance gets its own service scope. Multiple players
 * on the same page are fully isolated.
 *
 * @example
 * // Access via ViewChild when programmatic control is needed:
 * @ViewChild(StreamingPlayerComponent) player!: StreamingPlayerComponent;
 *
 * ngAfterViewInit() {
 *   this.player.play();
 *   this.player.seek(30);
 * }
 *
 * @example
 * // Hot-swap the source:
 * playerService.loadSource('https://example.com/new-stream.m3u8', {
 *   autoplay: true,
 * });
 */
@Injectable({ providedIn: 'root' })
export class PlayerService {
  /** The `<video>` element managed by this service instance. */
  private videoElement!: HTMLVideoElement;

  /** The player container element used for fullscreen requests and theming. */
  private containerElement!: HTMLElement;

  /** The currently active protocol adapter. */
  private adapter!: IPlayerAdapter;

  /** The last resolved configuration, merged on every `loadSource` call. */
  private config!: PlayerConfig;

  /** @internal Shared reactive state for this player instance. */
  private readonly stateService = inject(PlayerStateService);

  /** @internal Injectable YouTube adapter (Angular service, requires DI). */
  private readonly youtubeAdapter = inject(YouTubeAdapter);

  /**
   * Initialises the player for the first time.
   *
   * Detects (or uses the explicitly configured) protocol, creates the matching
   * adapter, initialises it with the resolved config, and applies the theme.
   *
   * Called by `StreamingPlayerComponent.ngAfterViewInit()`.
   *
   * @param videoElement - The native `<video>` element from the component template.
   * @param config - Fully resolved player configuration.
   */
  initialize(videoElement: HTMLVideoElement, config: PlayerConfig): void {
    this.videoElement = videoElement;
    this.config = config;

    const protocol = config.protocol || this.detectProtocol(config.src);
    this.adapter = this.createAdapter(protocol);
    this.adapter.initialize(config);
    this.applyTheme(config.theme);
  }

  /**
   * Stores the player container element.
   *
   * Used as the target for `requestFullscreen()` (so the controls bar is
   * included in the fullscreen view) and as the scope for CSS custom-property
   * theme overrides.
   *
   * Called by `StreamingPlayerComponent.ngAfterViewInit()` immediately after
   * {@link initialize}.
   *
   * @param container - The outermost `<div>` element of the player component.
   */
  setContainer(container: HTMLElement): void {
    this.containerElement = container;
  }

  /**
   * Forwards the YouTube iframe container reference to `YouTubeAdapter`.
   *
   * The YouTube adapter renders its `<iframe>` inside a dedicated container
   * that is separate from the native `<video>` element. This must be set
   * after `ngAfterViewInit` so the DOM element exists.
   *
   * @param container - The `<div>` reserved for the YouTube iframe.
   */
  setYouTubeContainer(container: HTMLElement): void {
    this.youtubeAdapter.setContainer(container);
  }

  /**
   * Infers the streaming protocol from the source URL when no explicit
   * `protocol` override is provided in the configuration.
   *
   * | URL pattern              | Protocol returned |
   * |--------------------------|-------------------|
   * | `youtube.com` / `youtu.be` | `'youtube'`     |
   * | contains `.m3u8`         | `'hls'`           |
   * | contains `.mpd`          | `'dash'`          |
   * | anything else            | `'native'`        |
   *
   * @param src - Raw media source URL.
   * @returns The inferred protocol string.
   */
  private detectProtocol(src: string): 'hls' | 'dash' | 'youtube' | 'native' {
    if (src.includes('youtube.com') || src.includes('youtu.be')) return 'youtube';
    if (src.includes('.m3u8')) return 'hls';
    if (src.includes('.mpd')) return 'dash';
    return 'native';
  }

  /**
   * Instantiates the correct adapter for the given protocol.
   *
   * `YouTubeAdapter` is an Angular service and is injected via DI. All other
   * adapters are plain classes instantiated with `new`.
   *
   * @param protocol - The resolved protocol string.
   * @returns A fresh `IPlayerAdapter` instance ready to be initialised.
   */
  private createAdapter(protocol: 'hls' | 'dash' | 'youtube' | 'native'): IPlayerAdapter {
    switch (protocol) {
      case 'hls':
        return new HlsAdapter(this.videoElement, this.stateService);
      case 'dash':
        return new DashAdapter(this.videoElement, this.stateService);
      case 'youtube':
        return this.youtubeAdapter;
      default:
        return new NativeAdapter(this.videoElement, this.stateService);
    }
  }

  /**
   * Applies a `PlayerTheme` to the container element as CSS custom properties.
   *
   * Properties are written to `containerElement.style.setProperty()` so each
   * player instance has its own theme scope without polluting global styles.
   * Falls back to `document.documentElement` when `containerElement` has not
   * yet been set.
   *
   * @param theme - Optional theme object. A `null` / `undefined` value is a
   *   no-op (default CSS variables from the component stylesheet are used).
   */
  private applyTheme(theme?: PlayerTheme): void {
    if (!theme) return;
    const el = this.containerElement || document.documentElement;
    const map: Partial<Record<keyof PlayerTheme, string>> = {
      primaryColor: '--ngx-sp-primary',
      secondaryColor: '--ngx-sp-secondary',
      accentColor: '--ngx-sp-accent',
      backgroundColor: '--ngx-sp-bg-dark',
      textColor: '--ngx-sp-text-light',
      borderRadius: '--ngx-sp-radius',
      controlSize: '--ngx-sp-control-size',
    };
    for (const [key, cssVar] of Object.entries(map)) {
      const val = (theme as any)[key];
      if (val) el.style.setProperty(cssVar!, val);
    }
  }

  // -- Playback API (delegates to active adapter) ----------------------------

  /**
   * Starts or resumes media playback.
   *
   * @returns A Promise that resolves when playback begins. May reject if the
   *   browser's autoplay policy blocks unmuted play.
   */
  play(): Promise<void> {
    return this.adapter.play();
  }

  /** Pauses playback without changing the current position. */
  pause(): void {
    this.adapter.pause();
  }

  /**
   * Seeks to the specified playback position.
   *
   * @param time - Target position in seconds.
   */
  seek(time: number): void {
    this.adapter.seek(time);
  }

  /**
   * Sets the audio volume.
   *
   * The value is clamped to `[0, 1]`. If the player was muted and the new
   * volume is greater than zero, mute is cleared automatically.
   *
   * @param volume - Desired volume level in the range `[0, 1]`.
   */
  setVolume(volume: number): void {
    const v = Math.max(0, Math.min(1, volume));
    this.adapter.setVolume(v);
    if (v > 0 && this.stateService.muted()) {
      this.setMuted(false);
    }
  }

  /**
   * Mutes or unmutes audio without changing the stored volume level.
   *
   * @param muted - `true` to mute, `false` to unmute.
   */
  setMuted(muted: boolean): void {
    this.adapter.setMuted(muted);
  }

  /**
   * Changes the playback speed.
   *
   * @param rate - Desired playback rate (e.g. `0.5`, `1`, `2`).
   */
  setPlaybackRate(rate: number): void {
    this.adapter.setPlaybackRate(rate);
  }

  /**
   * Switches the active quality level.
   *
   * @param quality - Quality label (e.g. `'1080p'`) or `'auto'` for ABR.
   */
  setQuality(quality: string): void {
    this.adapter.setQuality(quality);
  }

  /**
   * Toggles subtitles on or off.
   *
   * When enabling, activates the first available track. When disabling,
   * calls `setSubtitle(null)`.
   */
  toggleSubtitles(): void {
    if (this.stateService.subtitlesEnabled()) {
      this.adapter.setSubtitle(null);
    } else {
      const tracks = this.stateService.availableSubtitles();
      this.adapter.setSubtitle(tracks.length > 0 ? tracks[0].id : null);
    }
  }

  /**
   * Activates a specific subtitle track or disables subtitles.
   *
   * @param id - `SubtitleTrack.id` to activate, or `null` to disable.
   */
  setSubtitle(id: string | number | null): void {
    this.adapter.setSubtitle(id);
  }

  /**
   * Requests the browser to enter fullscreen mode using the player container.
   *
   * Vendor-prefixed variants (`webkit`, `ms`) are tried as fallbacks for
   * older browsers.
   */
  requestFullscreen(): void {
    const el = this.containerElement || this.videoElement;
    if (el.requestFullscreen) {
      el.requestFullscreen();
    } else if ((el as any).webkitRequestFullscreen) {
      (el as any).webkitRequestFullscreen();
    } else if ((el as any).msRequestFullscreen) {
      (el as any).msRequestFullscreen();
    }
  }

  /**
   * Exits fullscreen mode.
   *
   * Vendor-prefixed variants are tried as fallbacks.
   */
  exitFullscreen(): void {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if ((document as any).webkitExitFullscreen) {
      (document as any).webkitExitFullscreen();
    } else if ((document as any).msExitFullscreen) {
      (document as any).msExitFullscreen();
    }
  }

  /**
   * Requests Picture-in-Picture mode for the native `<video>` element.
   *
   * Guards against calling the API before the video has loaded metadata
   * (`readyState < HAVE_METADATA`). If the video is not ready, the request
   * is deferred until the `loadedmetadata` event fires.
   *
   * Has no effect when `PlayerStateService.supportsPiP()` is `false`
   * (e.g. on YouTube sources or unsupported browsers).
   */
  requestPiP(): void {
    if (!this.stateService.supportsPiP()) return;
    if (this.videoElement === document.pictureInPictureElement) return;

    const doPiP = () =>
      this.videoElement.requestPictureInPicture().catch((err) => {
        console.warn('[PlayerService] requestPictureInPicture failed:', err);
      });

    // readyState >= HAVE_METADATA (1) is required before PiP can be requested.
    if (this.videoElement.readyState >= 1) {
      doPiP();
    } else {
      this.videoElement.addEventListener('loadedmetadata', doPiP, { once: true });
    }
  }

  /**
   * Exits Picture-in-Picture mode.
   *
   * Any rejection (e.g. PiP was already exited) is forwarded to
   * `PlayerStateService.setError()`.
   */
  exitPiP(): void {
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch((err) => {
        this.stateService.setError(err);
      });
    }
  }

  /**
   * Hot-swaps the media source without recreating the Angular component.
   *
   * Steps:
   * 1. Destroys the current adapter (stopping playback and releasing resources).
   * 2. Resets all playback state via `PlayerStateService.reset()` (volume and
   *    mute are preserved across the reset).
   * 3. Merges `overrides` into the stored config.
   * 4. Auto-detects the protocol from the new `src` unless `overrides.protocol`
   *    is explicitly provided (prevents bleeding the previous adapter's protocol).
   * 5. Creates and initialises a new adapter for the new source.
   *
   * @param src - New media source URL.
   * @param overrides - Optional partial config overrides merged with the
   *   existing configuration (e.g. `{ autoplay: true }`).
   *
   * @example
   * // Switch from an HLS stream to an MP4:
   * playerService.loadSource(
   *   'https://example.com/video.mp4',
   *   { autoplay: true, muted: false },
   * );
   */
  loadSource(src: string, overrides: Partial<PlayerConfig> = {}): void {
    if (this.adapter) {
      this.adapter.destroy();
    }
    this.stateService.reset();
    this.config = { ...this.config, ...overrides, src };
    // Only honour overrides.protocol when it was explicitly provided.
    // Falling back to this.config.protocol would bleed the previous adapter's
    // protocol into the new load (e.g. 'native' from an MP4 into an HLS URL).
    const protocol =
      'protocol' in overrides && overrides.protocol != null
        ? overrides.protocol!
        : this.detectProtocol(src);
    this.config.protocol = protocol;
    this.adapter = this.createAdapter(protocol);
    this.adapter.initialize(this.config);
    this.applyTheme(this.config.theme);
  }

  /**
   * Destroys the active adapter and releases all resources.
   *
   * Called by `StreamingPlayerComponent.ngOnDestroy()`. Safe to call even
   * if no adapter has been created yet.
   */
  destroy(): void {
    if (this.adapter) {
      this.adapter.destroy();
    }
  }
}
