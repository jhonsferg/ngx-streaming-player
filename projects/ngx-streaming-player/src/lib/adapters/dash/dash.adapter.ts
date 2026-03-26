import * as dashjs from 'dashjs';
import { PlayerStateService } from '../../services/player-state.service';
import { IPlayerAdapter, PlayerConfig, SubtitleTrack } from '../../models/player.models';

/**
 * Adapter for MPEG-DASH streaming using the **dash.js** library.
 *
 * Handles ISO BMFF (fMP4) and MPEG-TS DASH segments, including live streams
 * with `type="dynamic"` manifests. Quality representation labels are derived
 * from the representation height (`1080p`) or bitrate (`2500k`).
 *
 * Notable behaviours:
 * - **Live detection** uses `MediaPlayer.isDynamic()` after `STREAM_INITIALIZED`.
 * - **Quality switching** disables ABR (`autoSwitchBitrate: false`) before
 *   calling `setQualityFor('video', index)` to prevent dash.js from
 *   immediately overriding the selection.
 * - **Text tracks** are queried via `getTracksFor('text')` on init.
 * - **Transient download errors** (fragment fetch failures that dash.js
 *   recovers automatically) are silently swallowed to avoid false-positive
 *   error states in the UI.
 *
 * @implements {IPlayerAdapter}
 *
 * @example
 * // DashAdapter is selected automatically for `.mpd` sources:
 * // <ngx-sp-player src="https://example.com/manifest.mpd"></ngx-sp-player>
 *
 * @example
 * // Or explicitly:
 * const config: PlayerConfig = {
 *   src: 'https://example.com/manifest.mpd',
 *   protocol: 'dash',
 *   autoplay: false,
 * };
 */
export class DashAdapter implements IPlayerAdapter {
  /** The dash.js `MediaPlayer` instance; `null` after `destroy()`. */
  private dash: any;

  /** Resolved player configuration stored during `initialize()`. */
  private config!: PlayerConfig;

  /** Internal readiness flag set to `true` after `STREAM_INITIALIZED`. */
  private _isReady = false;

  /**
   * Shared abort controller whose signal is passed to every native
   * `addEventListener()` call for clean bulk removal on destroy.
   */
  private abortController!: AbortController;

  /**
   * Creates a new `DashAdapter` instance.
   *
   * @param videoElement - The `<video>` element this adapter will manage.
   * @param stateService - Shared state service for propagating player events.
   */
  constructor(
    private readonly videoElement: HTMLVideoElement,
    private readonly stateService: PlayerStateService,
  ) {}

  /**
   * Initialises the DASH adapter.
   *
   * Steps performed:
   * 1. Registers native `<video>` listeners via `AbortController`.
   * 2. Creates a `dashjs.MediaPlayer` instance and initialises it with the
   *    manifest URL and the `<video>` element.
   * 3. On `STREAM_INITIALIZED`:
   *    - Extracts quality labels from `getBitrateInfoListFor('video')`.
   *    - Detects live streams via `isDynamic()`.
   *    - Queries text tracks for subtitle support.
   * 4. On `QUALITY_CHANGE_RENDERED`: syncs the active quality label in state.
   * 5. On `ERROR`: ignores transient download errors; forwards fatal errors.
   *
   * @param config - Resolved player configuration.
   */
  initialize(config: PlayerConfig): void {
    this.config = config;
    this.abortController = new AbortController();
    this.stateService.setSupportsPiP(
      !!document.pictureInPictureEnabled && !this.videoElement.disablePictureInPicture,
    );
    this.setupNativeEventListeners();

    if (dashjs) {
      this.dash = dashjs.MediaPlayer().create();
      this.dash.initialize(this.videoElement, config.src, config.autoplay);

      this.dash.on(dashjs.MediaPlayer.events['STREAM_INITIALIZED'], () => {
        const bitrates = this.dash.getBitrateInfoListFor('video');
        const qualities = bitrates.map((b: any) =>
          b.height > 0 ? `${b.height}p` : `${Math.round(b.bitrate / 1000)}k`,
        );
        this.stateService.setAvailableQualities(qualities);
        this.stateService.setQuality('auto');
        this._isReady = true;

        try {
          if (this.dash.isDynamic && this.dash.isDynamic()) {
            this.stateService.setLive(true);
          }
        } catch {
          // intentionally swallowed — dash.js may throw on unavailable APIs
        }

        // Detect available subtitle / text tracks.
        try {
          const textTracks = this.dash.getTracksFor('text');
          const subtitleTracks: SubtitleTrack[] = (textTracks || []).map((t: any) => ({
            id: t.id,
            label: t.labels?.[0]?.text || t.lang || `Track ${t.id}`,
            language: t.lang || '',
          }));
          this.stateService.setSupportsSubtitles(subtitleTracks.length > 0);
          this.stateService.setAvailableSubtitles(subtitleTracks);
        } catch {
          // intentionally swallowed — dash.js may throw on unavailable APIs
        }
      });

      this.dash.on(
        dashjs.MediaPlayer.events['QUALITY_CHANGE_RENDERED'],
        (_event: any, data: any) => {
          if (data.mediaType === 'video' && data.newRepresentation) {
            const rep = data.newRepresentation;
            const label =
              rep.height > 0
                ? `${rep.height}p`
                : rep.bandwidth > 0
                  ? `${Math.round(rep.bandwidth / 1000)}k`
                  : null;
            if (label) {
              this.stateService.setQuality(label);
            }
          }
        },
      );

      this.dash.on(dashjs.MediaPlayer.events['ERROR'], (e: any) => {
        // Skip transient download errors (fragment fetch failures) —
        // dash.js recovers automatically from these.
        if (e?.error === 'download') return;
        this.stateService.setError(e?.error || e);
      });
    } else {
      this.stateService.setError('DASH is not supported in this browser.');
    }

    if (config.poster) this.videoElement.poster = config.poster;
    if (config.volume !== undefined) this.setVolume(config.volume);
    if (config.muted !== undefined) this.setMuted(config.muted);
  }

  /**
   * Attaches native `<video>` element event listeners.
   *
   * All listeners share the `AbortController` signal for atomic removal
   * during `destroy()`.
   */
  private setupNativeEventListeners(): void {
    const v = this.videoElement;
    const o = { signal: this.abortController.signal };

    v.addEventListener('play', () => this.stateService.setPlaying(true), o);
    v.addEventListener('pause', () => this.stateService.setPlaying(false), o);
    v.addEventListener('waiting', () => this.stateService.setBuffering(true), o);
    v.addEventListener('playing', () => this.stateService.setBuffering(false), o);
    v.addEventListener('canplay', () => this.stateService.setBuffering(false), o);
    v.addEventListener('timeupdate', () => this.stateService.setCurrentTime(v.currentTime), o);
    v.addEventListener(
      'progress',
      () => {
        if (isFinite(v.duration) && v.duration > 0 && v.buffered.length > 0) {
          const bufferedEnd = v.buffered.end(v.buffered.length - 1);
          this.stateService.setBufferedPercentage((bufferedEnd / v.duration) * 100);
        }
      },
      o,
    );
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
   * Starts or resumes playback.
   *
   * @returns The Promise from `HTMLVideoElement.play()`.
   */
  play(): Promise<void> {
    return this.videoElement.play();
  }

  /** Pauses playback. */
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
   * Sets the audio volume, clamping to `[0, 1]`.
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
   * @param rate - Desired rate (e.g. `1.5`).
   */
  setPlaybackRate(rate: number): void {
    this.videoElement.playbackRate = rate;
  }

  /**
   * Switches to the specified quality level.
   *
   * - `'auto'` re-enables ABR via `autoSwitchBitrate: { video: true }`.
   * - A named quality disables ABR first, then calls `setQualityFor('video', index)`.
   *
   * @param quality - Quality label (e.g. `'1080p'`) or `'auto'`.
   */
  setQuality(quality: string): void {
    if (!this.dash) return;

    if (quality === 'auto') {
      this.dash.updateSettings({ streaming: { abr: { autoSwitchBitrate: { video: true } } } });
    } else {
      const qualities = this.stateService.availableQualities();
      const index = qualities.indexOf(quality);
      if (index !== -1) {
        this.dash.updateSettings({ streaming: { abr: { autoSwitchBitrate: { video: false } } } });
        this.dash.setQualityFor('video', index);
      }
    }
    this.stateService.setQuality(quality);
  }

  /**
   * Activates a text / subtitle track or disables all subtitles.
   *
   * Uses `setCurrentTrack()` to select the target track object and
   * `setTextTrack(0)` to enable rendering. Passing `null` calls
   * `setTextTrack(-1)` to disable all text tracks.
   *
   * @param id - Track ID to activate, or `null` to disable subtitles.
   */
  setSubtitle(id: string | number | null): void {
    if (!this.dash) return;
    if (id === null) {
      try {
        this.dash.setTextTrack(-1);
      } catch {
        // intentionally swallowed — dash.js may throw on unavailable APIs
      }
      this.stateService.setSubtitles(false);
      this.stateService.setActiveSubtitleId(null);
    } else {
      try {
        const textTracks = this.dash.getTracksFor('text');
        const target = textTracks.find((t: any) => String(t.id) === String(id));
        if (target) this.dash.setCurrentTrack(target);
        this.dash.setTextTrack(0);
      } catch {
        // intentionally swallowed — dash.js may throw on unavailable APIs
      }
      this.stateService.setSubtitles(true);
      this.stateService.setActiveSubtitleId(id);
    }
  }

  /**
   * Returns `true` after the DASH stream has been initialised
   * (`STREAM_INITIALIZED` event).
   */
  isReady(): boolean {
    return this._isReady;
  }

  /**
   * Resets the dash.js player and removes all event listeners.
   *
   * `dash.reset()` detaches the `<video>` element and releases all internal
   * resources. The `AbortController` removes the native DOM listeners.
   */
  destroy(): void {
    this.abortController?.abort();
    if (this.dash) {
      this.dash.reset();
      this.dash = null;
    }
    this._isReady = false;
  }
}
