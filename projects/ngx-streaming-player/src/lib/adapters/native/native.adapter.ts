import { PlayerStateService } from '../../services/player-state.service';
import { IPlayerAdapter, PlayerConfig, SubtitleTrack } from '../../models/player.models';

/**
 * Adapter for native HTML5 `<video>` playback.
 *
 * Handles MP4, WebM, Ogg, and any other format natively supported by the
 * browser. Subtitle and caption tracks embedded in the media file (via
 * `<track>` elements or side-car files) are detected from the video element's
 * `TextTrackList` on the `loadedmetadata` event.
 *
 * All native DOM event listeners are registered with a shared
 * `AbortController` signal so that a single `abort()` call removes every
 * listener atomically — avoiding the "zombie listener" problem that can
 * trigger spurious state updates after `destroy()` is called.
 *
 * @implements {IPlayerAdapter}
 *
 * @example
 * // NativeAdapter is selected automatically for MP4 sources:
 * // <ngx-sp-player src="https://example.com/video.mp4"></ngx-sp-player>
 *
 * @example
 * // Or force it explicitly:
 * const config: PlayerConfig = {
 *   src: 'https://example.com/video.mp4',
 *   protocol: 'native',
 *   poster: 'https://example.com/poster.jpg',
 *   autoplay: false,
 * };
 */
export class NativeAdapter implements IPlayerAdapter {
  /** Resolved player configuration stored during `initialize()`. */
  private config!: PlayerConfig;

  /** Internal readiness flag flipped to `true` after `initialize()`. */
  private _isReady = false;

  /**
   * Shared abort controller whose signal is passed to every
   * `addEventListener()` call so all listeners are removed in one `abort()`.
   */
  private abortController!: AbortController;

  /**
   * Creates a new `NativeAdapter` instance.
   *
   * @param videoElement - The `<video>` element managed by this adapter.
   * @param stateService - Shared state service used to propagate playback
   *   events to the rest of the player UI.
   */
  constructor(
    private readonly videoElement: HTMLVideoElement,
    private readonly stateService: PlayerStateService,
  ) {}

  /**
   * Initialises the adapter for the given configuration.
   *
   * Steps performed:
   * 1. Detects and stores PiP support for this device/browser combination.
   * 2. Registers all native `<video>` event listeners via `AbortController`.
   * 3. Sets `src`, `poster`, initial `volume`, and initial `muted` state.
   * 4. On `loadedmetadata`, auto-detects embedded subtitle tracks and
   *    optionally starts autoplay.
   *
   * @param config - Resolved player configuration.
   */
  initialize(config: PlayerConfig): void {
    this.config = config;
    this.abortController = new AbortController();
    this.stateService.setSupportsPiP(
      !!document.pictureInPictureEnabled && !this.videoElement.disablePictureInPicture,
    );
    this.setupEventListeners();
    this.videoElement.src = config.src;

    if (config.poster) {
      this.videoElement.poster = config.poster;
    }
    if (config.volume !== undefined) {
      this.setVolume(config.volume);
    }
    if (config.muted !== undefined) {
      this.setMuted(config.muted);
    }

    this.videoElement.addEventListener(
      'loadedmetadata',
      () => {
        this.detectSubtitleTracks();
        if (config.autoplay) this.play();
      },
      { once: true },
    );

    this._isReady = true;
  }

  /**
   * Scans `HTMLVideoElement.textTracks` for subtitle and caption tracks and
   * updates `PlayerStateService` with the results.
   *
   * Called once on the `loadedmetadata` event. Tracks with `kind` values of
   * `'subtitles'` or `'captions'` are included; metadata and description
   * tracks are ignored.
   */
  private detectSubtitleTracks(): void {
    const tracks = this.videoElement.textTracks;
    const subtitleTracks: SubtitleTrack[] = [];
    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i];
      if (t.kind === 'subtitles' || t.kind === 'captions') {
        subtitleTracks.push({
          id: String(i),
          label: t.label || t.language || `Track ${i + 1}`,
          language: t.language,
        });
      }
    }
    this.stateService.setSupportsSubtitles(subtitleTracks.length > 0);
    this.stateService.setAvailableSubtitles(subtitleTracks);
  }

  /**
   * Registers all native `<video>` DOM event listeners.
   *
   * Every listener uses the shared `AbortController` signal so that calling
   * `abortController.abort()` in `destroy()` removes them all at once,
   * preventing any stale callbacks from firing after the adapter is torn down.
   */
  private setupEventListeners(): void {
    const v = this.videoElement;
    const o = { signal: this.abortController.signal };

    v.addEventListener('play', () => this.stateService.setPlaying(true), o);
    v.addEventListener('pause', () => this.stateService.setPlaying(false), o);
    v.addEventListener('waiting', () => this.stateService.setBuffering(true), o);
    v.addEventListener('playing', () => this.stateService.setBuffering(false), o);
    v.addEventListener('canplay', () => this.stateService.setBuffering(false), o);
    v.addEventListener('timeupdate', () => this.stateService.setCurrentTime(v.currentTime), o);
    v.addEventListener('progress', () => this.updateBufferedPercentage(v), o);
    v.addEventListener(
      'durationchange',
      () => {
        this.stateService.setDuration(v.duration);
        if (!isFinite(v.duration)) {
          this.stateService.setLive(true);
        }
      },
      o,
    );
    v.addEventListener(
      'volumechange',
      () => {
        this.stateService.setVolume(v.volume);
        this.stateService.setMuted(v.muted);
      },
      o,
    );
    v.addEventListener('ratechange', () => this.stateService.setPlaybackRate(v.playbackRate), o);
    v.addEventListener('ended', () => {
      this.stateService.setPlaying(false);
      this.stateService.setEnded(true);
    }, o);
    v.addEventListener('error', (e) => this.stateService.setError(e), o);
  }

  /**
   * Calculates the buffered percentage from `HTMLVideoElement.buffered` and
   * forwards the value to `PlayerStateService`.
   *
   * Only runs when `duration` is finite and positive to avoid division-by-zero
   * on live streams or before the metadata has loaded.
   *
   * @param v - The `<video>` element whose `buffered` ranges to inspect.
   */
  private updateBufferedPercentage(v: HTMLVideoElement): void {
    if (isFinite(v.duration) && v.duration > 0 && v.buffered.length > 0) {
      const bufferedEnd = v.buffered.end(v.buffered.length - 1);
      this.stateService.setBufferedPercentage((bufferedEnd / v.duration) * 100);
    }
  }

  /**
   * Starts or resumes playback.
   *
   * @returns The Promise returned by `HTMLVideoElement.play()`, which rejects
   *   if the browser's autoplay policy blocks unmuted playback.
   */
  play(): Promise<void> {
    return this.videoElement.play();
  }

  /** Pauses playback without changing the current position. */
  pause(): void {
    this.videoElement.pause();
  }

  /**
   * Seeks to the given position if it falls within `[0, duration]`.
   *
   * @param time - Target position in seconds.
   */
  seek(time: number): void {
    if (time >= 0 && time <= this.videoElement.duration) {
      this.videoElement.currentTime = time;
    }
  }

  /**
   * Sets the audio volume, clamping the value to `[0, 1]`.
   *
   * @param volume - Desired volume level.
   */
  setVolume(volume: number): void {
    this.videoElement.volume = Math.max(0, Math.min(1, volume));
  }

  /**
   * Mutes or unmutes audio.
   *
   * @param muted - `true` to mute, `false` to unmute.
   */
  setMuted(muted: boolean): void {
    this.videoElement.muted = muted;
  }

  /**
   * Changes the playback rate.
   *
   * @param rate - Desired rate (e.g. `0.5`, `1`, `2`).
   */
  setPlaybackRate(rate: number): void {
    this.videoElement.playbackRate = rate;
  }

  /**
   * No-op — native `<video>` does not support adaptive quality switching.
   *
   * @param _quality - Ignored.
   */
  setQuality(_quality: string): void {
    // Native video does not support quality switching.
  }

  /**
   * Activates a subtitle or caption track, or disables all tracks.
   *
   * Only tracks with `kind === 'subtitles'` or `kind === 'captions'` are
   * considered. All other tracks in the `TextTrackList` are left untouched.
   *
   * @param id - Numeric string index into the `TextTrackList` to activate,
   *   or `null` to disable all subtitle/caption tracks.
   */
  setSubtitle(id: string | number | null): void {
    const tracks = this.videoElement.textTracks;
    let activated = false;
    for (let i = 0; i < tracks.length; i++) {
      if (tracks[i].kind === 'subtitles' || tracks[i].kind === 'captions') {
        if (id !== null && String(i) === String(id)) {
          tracks[i].mode = 'showing';
          activated = true;
        } else {
          tracks[i].mode = 'hidden';
        }
      }
    }
    this.stateService.setSubtitles(id !== null && activated);
    this.stateService.setActiveSubtitleId(id !== null && activated ? id : null);
  }

  /**
   * Returns `true` immediately after `initialize()` is called, since native
   * video does not require an asynchronous setup phase.
   */
  isReady(): boolean {
    return this._isReady;
  }

  /**
   * Tears down the adapter.
   *
   * The `AbortController` is aborted **before** the `src` attribute is
   * cleared to prevent the browser's `error` event (fired when the source is
   * removed mid-load) from reaching `stateService` and surfacing a spurious
   * error in the UI.
   */
  destroy(): void {
    this.abortController?.abort();
    this.videoElement.pause();
    this.videoElement.removeAttribute('src');
    this.videoElement.load(); // resets internal state and clears buffered ranges
    this._isReady = false;
  }
}
