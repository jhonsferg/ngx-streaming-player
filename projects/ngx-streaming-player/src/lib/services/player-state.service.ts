import { Injectable, computed, signal, Signal } from '@angular/core';
import { PlayerState, SubtitleTrack } from '../models/player.models';

/**
 * Single source of truth for all reactive player state.
 *
 * `PlayerStateService` owns every writable `Signal` that represents the
 * current condition of the player (playback, buffering, volume, quality,
 * subtitles, fullscreen, PiP, errors, …). It exposes them as **read-only**
 * signals to the rest of the application and provides named mutator methods
 * that the adapters and `PlayerService` call to drive state transitions.
 *
 * ### Architecture notes
 * - All private `_signal` fields are the writable source; the public readonly
 *   counterparts (`readonly quality`, `readonly currentQuality`, …) are derived
 *   with `.asReadonly()` so consumers can never write to them directly.
 * - The `state` computed signal aggregates all fields into a single
 *   `PlayerState` snapshot — useful for emitting the `stateChange` output or
 *   persisting the full snapshot to external stores.
 * - `reset()` restores every playback-related signal to its initial value
 *   while **preserving** `volume` and `muted` across hot-swaps so the user's
 *   audio preferences survive a source change.
 *
 * ### Usage
 * Inject this service inside the player component tree (it is provided in
 * `StreamingPlayerComponent.providers`) and read signals reactively:
 *
 * @example
 * // Inside a component that lives inside <ngx-sp-player>
 * readonly state = inject(PlayerStateService);
 *
 * // Template binding
 * // {{ state.formattedCurrentTime() }} / {{ state.formattedDuration() }}
 *
 * @example
 * // Programmatic access via NgxPlayerControlService
 * const stateService = playerControl.getState('my-player');
 * effect(() => {
 *   if (stateService?.isPlaying()) doSomething();
 * });
 */
@Injectable({ providedIn: 'root' })
export class PlayerStateService {
  // -- Private writable signals ----------------------------------------------

  /** @internal */ private readonly _isPlaying = signal(false);
  /** @internal */ private readonly _isBuffering = signal(false);
  /** @internal */ private readonly _currentTime = signal(0);
  /** @internal */ private readonly _duration = signal(0);
  /** @internal */ private readonly _volume = signal(1);
  /** @internal */ private readonly _muted = signal(false);
  /** @internal */ private readonly _playbackRate = signal(1);
  /** @internal */ private readonly _quality = signal('auto');
  /** @internal */ private readonly _availableQualities = signal<string[]>([]);
  /** @internal */ private readonly _isFullscreen = signal(false);
  /** @internal */ private readonly _isPiP = signal(false);
  /** @internal */ private readonly _isYouTube = signal(false);
  /** @internal */ private readonly _isLive = signal(false);
  /** @internal */ private readonly _subtitlesEnabled = signal(false);
  /** @internal */ private readonly _supportsSubtitles = signal(false);
  /** @internal */ private readonly _availableSubtitles = signal<SubtitleTrack[]>([]);
  /** @internal */ private readonly _activeSubtitleId = signal<string | number | null>(null);
  /** @internal */ private readonly _supportsPiP = signal(false);
  /** @internal */ private readonly _isEnded = signal(false);
  /** @internal */ private readonly _error = signal<any | null>(null);
  /** @internal */ private readonly _bufferedPercentage = signal(0);

  // -- Public read-only signals ----------------------------------------------

  /** `true` while media is actively playing. */
  readonly isPlaying = this._isPlaying.asReadonly();

  /** `true` while the player is stalled waiting for data. */
  readonly isBuffering = this._isBuffering.asReadonly();

  /** Current playback position in seconds. */
  readonly currentTime = this._currentTime.asReadonly();

  /** Total media duration in seconds (`Infinity` for live streams). */
  readonly duration = this._duration.asReadonly();

  /** Current volume level in the range `[0, 1]`. */
  readonly volume = this._volume.asReadonly();

  /** Whether audio output is muted. */
  readonly muted = this._muted.asReadonly();

  /** Active playback rate (1 = normal speed). */
  readonly playbackRate = this._playbackRate.asReadonly();

  /**
   * Human-readable label of the currently active quality level
   * (e.g. `'1080p'`, `'720p'`, `'auto'`).
   */
  readonly quality = this._quality.asReadonly();

  /**
   * Alias for {@link quality} — provided for semantic clarity in code that
   * refers to the "current quality" rather than the concept of "quality".
   */
  readonly currentQuality = this._quality.asReadonly();

  /** All quality labels available for the current source. */
  readonly availableQualities = this._availableQualities.asReadonly();

  /** Whether the player is currently in browser fullscreen mode. */
  readonly isFullscreen = this._isFullscreen.asReadonly();

  /** Whether the player is currently in Picture-in-Picture mode. */
  readonly isPiP = this._isPiP.asReadonly();

  /** `true` when the active adapter is `YouTubeAdapter`. */
  readonly isYouTube = this._isYouTube.asReadonly();

  /** `true` when the source is a live / unbounded stream. */
  readonly isLive = this._isLive.asReadonly();

  /** Whether subtitle or caption rendering is currently active. */
  readonly subtitlesEnabled = this._subtitlesEnabled.asReadonly();

  /** Whether the current source exposes at least one subtitle track. */
  readonly supportsSubtitles = this._supportsSubtitles.asReadonly();

  /** All subtitle tracks detected for the current source. */
  readonly availableSubtitles = this._availableSubtitles.asReadonly();

  /**
   * The `SubtitleTrack.id` of the currently active subtitle track,
   * or `null` when subtitles are disabled.
   */
  readonly activeSubtitleId = this._activeSubtitleId.asReadonly();

  /**
   * Whether the browser / device supports Picture-in-Picture for the
   * current source. Always `false` for YouTube sources.
   */
  readonly supportsPiP = this._supportsPiP.asReadonly();

  /** Last error thrown by the active adapter, or `null` when healthy. */
  readonly error = this._error.asReadonly();

  /** `true` when the media has reached its natural end. */
  readonly isEnded = this._isEnded.asReadonly();

  /** Percentage of the media that has been buffered, in the range `[0, 100]`. */
  readonly bufferedPercentage = this._bufferedPercentage.asReadonly();

  // -- Computed signals ------------------------------------------------------

  /**
   * Full state snapshot as a computed `PlayerState` object.
   *
   * Re-evaluates whenever any individual signal it reads changes. Use this
   * to pass a single reactive value to the `stateChange` output or to an
   * external state manager.
   *
   * @example
   * effect(() => {
   *   console.log('Player state:', stateService.state());
   * });
   */
  readonly state: Signal<PlayerState> = computed(() => ({
    isPlaying: this._isPlaying(),
    isBuffering: this._isBuffering(),
    currentTime: this._currentTime(),
    duration: this._duration(),
    volume: this._volume(),
    muted: this._muted(),
    playbackRate: this._playbackRate(),
    quality: this._quality(),
    availableQualities: this._availableQualities(),
    isFullscreen: this._isFullscreen(),
    isPiP: this._isPiP(),
    isYouTube: this._isYouTube(),
    isLive: this._isLive(),
    subtitlesEnabled: this._subtitlesEnabled(),
    isEnded: this._isEnded(),
    error: this._error(),
  }));

  /**
   * Playback progress expressed as a percentage in the range `[0, 100]`.
   * Returns `0` when `duration` is not yet known (avoids division by zero).
   *
   * @example
   * // Bind to a CSS width or transform:
   * // [style.width.%]="stateService.progress()"
   */
  readonly progress = computed(() => {
    const dur = this._duration();
    return dur > 0 ? (this._currentTime() / dur) * 100 : 0;
  });

  /**
   * Current time formatted as a human-readable string (`mm:ss` or `h:mm:ss`).
   *
   * @example
   * // "1:23:45"  (for 1 h 23 m 45 s)
   * // "03:07"    (for 3 m 7 s)
   */
  readonly formattedCurrentTime = computed(() => this.formatTime(this._currentTime()));

  /**
   * Total duration formatted as a human-readable string (`mm:ss` or `h:mm:ss`).
   * Returns `'00:00'` before metadata has loaded.
   */
  readonly formattedDuration = computed(() => this.formatTime(this._duration()));

  // -- Private helpers -------------------------------------------------------

  /**
   * Converts a raw number of seconds to a display string.
   *
   * @param time - Duration or position in seconds.
   * @returns `'h:mm:ss'` when `time >= 3600`, otherwise `'mm:ss'`.
   *   Returns `'00:00'` for `NaN`.
   */
  private formatTime(time: number): string {
    if (isNaN(time)) return '00:00';
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  // -- State mutators --------------------------------------------------------
  // All mutators are called exclusively by adapters and PlayerService.
  // External consumers should use PlayerService / NgxPlayerControlService.

  /**
   * Sets the playing state.
   * @param isPlaying - `true` when playback is active.
   */
  setPlaying(isPlaying: boolean): void {
    this._isPlaying.set(isPlaying);
  }

  /**
   * Sets the buffering state.
   * @param isBuffering - `true` when the player is waiting for data.
   */
  setBuffering(isBuffering: boolean): void {
    this._isBuffering.set(isBuffering);
  }

  /**
   * Updates the current playback position.
   * @param time - Position in seconds.
   */
  setCurrentTime(time: number): void {
    this._currentTime.set(time);
  }

  /**
   * Sets the total duration of the current media.
   * @param duration - Duration in seconds (`Infinity` for live streams).
   */
  setDuration(duration: number): void {
    this._duration.set(duration);
  }

  /**
   * Updates the volume level.
   * @param volume - Volume in the range `[0, 1]`.
   */
  setVolume(volume: number): void {
    this._volume.set(volume);
  }

  /**
   * Updates the muted state.
   * @param muted - `true` when audio is muted.
   */
  setMuted(muted: boolean): void {
    this._muted.set(muted);
  }

  /**
   * Updates the active playback rate.
   * @param rate - Playback rate (1 = normal speed).
   */
  setPlaybackRate(rate: number): void {
    this._playbackRate.set(rate);
  }

  /**
   * Updates the active quality label.
   * @param quality - Human-readable quality string (e.g. `'1080p'`, `'auto'`).
   */
  setQuality(quality: string): void {
    this._quality.set(quality);
  }

  /**
   * Replaces the full list of available quality labels.
   * @param qualities - Ordered array of quality strings.
   */
  setAvailableQualities(qualities: string[]): void {
    this._availableQualities.set(qualities);
  }

  /**
   * Updates the fullscreen state.
   * @param isFullscreen - `true` when the player is in fullscreen.
   */
  setFullscreen(isFullscreen: boolean): void {
    this._isFullscreen.set(isFullscreen);
  }

  /**
   * Updates the Picture-in-Picture state.
   * @param isPiP - `true` when the player is in PiP mode.
   */
  setPiP(isPiP: boolean): void {
    this._isPiP.set(isPiP);
  }

  /**
   * Updates the buffered percentage.
   * @param percentage - Buffered amount in the range `[0, 100]`.
   */
  setBufferedPercentage(percentage: number): void {
    this._bufferedPercentage.set(percentage);
  }

  /**
   * Marks whether the active adapter is YouTube.
   * @param isYouTube - `true` for `YouTubeAdapter`.
   */
  setYouTube(isYouTube: boolean): void {
    this._isYouTube.set(isYouTube);
  }

  /**
   * Marks whether the current source is a live / unbounded stream.
   * @param isLive - `true` for live streams.
   */
  setLive(isLive: boolean): void {
    this._isLive.set(isLive);
  }

  /**
   * Updates whether subtitles are currently active.
   * @param enabled - `true` when a subtitle track is rendering.
   */
  setSubtitles(enabled: boolean): void {
    this._subtitlesEnabled.set(enabled);
  }

  /**
   * Sets whether the current source has at least one subtitle track.
   * @param supported - `true` when subtitle tracks were detected.
   */
  setSupportsSubtitles(supported: boolean): void {
    this._supportsSubtitles.set(supported);
  }

  /**
   * Replaces the list of detected subtitle tracks.
   * @param tracks - Array of `SubtitleTrack` objects.
   */
  setAvailableSubtitles(tracks: SubtitleTrack[]): void {
    this._availableSubtitles.set(tracks);
  }

  /**
   * Sets the currently active subtitle track ID.
   * @param id - Active track ID, or `null` when subtitles are off.
   */
  setActiveSubtitleId(id: string | number | null): void {
    this._activeSubtitleId.set(id);
  }

  /**
   * Marks whether the browser supports Picture-in-Picture for this source.
   * Always set to `false` for YouTube sources.
   * @param supported - `true` when PiP is available.
   */
  setSupportsPiP(supported: boolean): void {
    this._supportsPiP.set(supported);
  }

  /**
   * Records the most recent adapter or playback error.
   * @param error - Error object, string, or `null` to clear.
   */
  setError(error: any | null): void {
    this._error.set(error);
  }

  /**
   * Marks whether the media has reached its natural end.
   * Automatically reset to `false` by {@link reset} on every source change.
   * @param ended - `true` when the video ends, `false` to clear.
   */
  setEnded(ended: boolean): void {
    this._isEnded.set(ended);
  }

  /**
   * Resets all playback-related signals to their initial values.
   *
   * **Volume and muted state are intentionally preserved** so that the user's
   * audio preferences survive a hot-swap source change.
   *
   * Called by `PlayerService.loadSource()` before creating a new adapter.
   */
  reset(): void {
    this._isPlaying.set(false);
    this._isBuffering.set(false);
    this._currentTime.set(0);
    this._duration.set(0);
    this._playbackRate.set(1);
    this._quality.set('auto');
    this._availableQualities.set([]);
    this._isFullscreen.set(false);
    this._isPiP.set(false);
    this._isYouTube.set(false);
    this._isLive.set(false);
    this._subtitlesEnabled.set(false);
    this._supportsSubtitles.set(false);
    this._availableSubtitles.set([]);
    this._activeSubtitleId.set(null);
    this._supportsPiP.set(false);
    this._isEnded.set(false);
    this._error.set(null);
    this._bufferedPercentage.set(0);
  }
}
