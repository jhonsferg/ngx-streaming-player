import Hls from 'hls.js';
import { PlayerStateService } from '../../services/player-state.service';
import { IPlayerAdapter, PlayerConfig, SubtitleTrack } from '../../models/player.models';

/**
 * Adapter for HTTP Live Streaming (HLS) using the **hls.js** library.
 *
 * On browsers that support Media Source Extensions (MSE), hls.js is used to
 * fetch and demux the MPEG-TS/CMAF segments. On Safari (and iOS WebKit),
 * HLS is supported natively by the `<video>` element, so the adapter falls
 * back to a plain `src` assignment instead.
 *
 * Notable behaviours:
 * - **Low-latency mode** is intentionally disabled at startup and enabled
 *   only once a `LEVEL_LOADED` event confirms the stream is live, avoiding
 *   aggressive pre-fetching on VOD content.
 * - **Quality labels** are derived from the level height (`720p`) or bitrate
 *   (`2500k`) and deduplicated before being forwarded to `PlayerStateService`.
 * - **Fatal errors** trigger automatic recovery (`startLoad` for network
 *   errors, `recoverMediaError` for codec/media errors). Only unrecoverable
 *   errors are propagated to the state service.
 * - **Subtitle tracks** are registered via `SUBTITLE_TRACKS_UPDATED` and
 *   activated by setting `hls.subtitleTrack` to the track index.
 *
 * @implements {IPlayerAdapter}
 *
 * @example
 * // HlsAdapter is selected automatically for `.m3u8` sources:
 * // <ngx-sp-player src="https://example.com/stream.m3u8"></ngx-sp-player>
 *
 * @example
 * // Or explicitly:
 * const config: PlayerConfig = {
 *   src: 'https://example.com/stream.m3u8',
 *   protocol: 'hls',
 *   autoplay: false,
 * };
 */
export class HlsAdapter implements IPlayerAdapter {
  /** The hls.js instance; `null` on Safari (native HLS path). */
  private hls: any;

  /** Resolved player configuration stored during `initialize()`. */
  private config!: PlayerConfig;

  /** Internal readiness flag set to `true` after `MANIFEST_PARSED`. */
  private _isReady = false;

  /**
   * Shared abort controller whose signal is passed to every native
   * `addEventListener()` call for clean bulk removal on destroy.
   */
  private abortController!: AbortController;

  /**
   * Creates a new `HlsAdapter` instance.
   *
   * @param videoElement - The `<video>` element this adapter will manage.
   * @param stateService - Shared state service for propagating player events.
   */
  constructor(
    private readonly videoElement: HTMLVideoElement,
    private readonly stateService: PlayerStateService,
  ) {}

  /**
   * Initialises the HLS adapter.
   *
   * **hls.js path** (MSE-capable browsers):
   * 1. Creates an `Hls` instance with conservative buffer limits.
   * 2. Loads the manifest, attaches to the `<video>` element.
   * 3. On `MANIFEST_PARSED`: extracts quality labels and triggers autoplay.
   * 4. On `LEVEL_LOADED`: detects live streams and enables low-latency mode.
   * 5. On `SUBTITLE_TRACKS_UPDATED`: populates the subtitle track list.
   * 6. On `ERROR`: attempts auto-recovery for fatal network/media errors.
   *
   * **Safari native path** (`canPlayType('application/vnd.apple.mpegurl')`):
   * Sets `src` directly and waits for `loadedmetadata`.
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

    if (Hls.isSupported()) {
      this.hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false, // enabled only when live is confirmed (avoids aggressive fetching on VOD)
        maxBufferLength: 20, // keep a smaller buffer to limit memory per instance
        maxMaxBufferLength: 40,
      });
      this.hls.loadSource(config.src);
      this.hls.attachMedia(this.videoElement);

      this.hls.on(Hls.Events.MANIFEST_PARSED, (_event: any, data: any) => {
        const qualities = data.levels
          .map((l: any, i: number) =>
            l.height > 0
              ? `${l.height}p`
              : l.bitrate > 0
                ? `${Math.round(l.bitrate / 1000)}k`
                : `Level ${i + 1}`,
          )
          .filter((q: string, i: number, arr: string[]) => arr.indexOf(q) === i);
        this.stateService.setAvailableQualities(qualities);
        this.stateService.setQuality('auto');
        this._isReady = true;
        if (config.autoplay) this.play();
      });

      this.hls.on(Hls.Events.LEVEL_LOADED, (_event: any, data: any) => {
        if (data.details?.live) {
          this.stateService.setLive(true);
          // Enable low-latency tuning now that we know it's a live stream.
          this.hls.config.lowLatencyMode = true;
        }
      });

      this.hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_event: any, data: any) => {
        const tracks: SubtitleTrack[] = (data.subtitleTracks || []).map((t: any) => ({
          id: t.id,
          label: t.name || t.lang || `Track ${t.id + 1}`,
          language: t.lang || '',
        }));
        this.stateService.setSupportsSubtitles(tracks.length > 0);
        this.stateService.setAvailableSubtitles(tracks);
      });

      this.hls.on(Hls.Events.ERROR, (_event: any, data: any) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              // Attempt to recover by restarting the load pipeline.
              this.hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              // Attempt MSE codec recovery.
              this.hls.recoverMediaError();
              break;
            default:
              // Unrecoverable error — surface it to the UI.
              this.stateService.setError(data);
              break;
          }
        }
      });
    } else if (this.videoElement.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari supports HLS natively via the <video> element.
      this.videoElement.src = config.src;
      this.videoElement.addEventListener(
        'loadedmetadata',
        () => {
          this._isReady = true;
          if (config.autoplay) this.play();
        },
        { once: true },
      );
    } else {
      this.stateService.setError('HLS is not supported in this browser.');
    }

    if (config.poster) this.videoElement.poster = config.poster;
    if (config.volume !== undefined) this.setVolume(config.volume);
    if (config.muted !== undefined) this.setMuted(config.muted);
  }

  /**
   * Attaches native `<video>` element listeners for playback state, time,
   * buffering, volume, and errors.
   *
   * All listeners share the `AbortController` signal so they are removed
   * atomically when the adapter is destroyed.
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

  /** Pauses playback without changing the current position. */
  pause(): void {
    this.videoElement.pause();
  }

  /**
   * Seeks to the given position if it is within `[0, duration]`.
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
   * @param rate - Desired playback rate (e.g. `1.5`).
   */
  setPlaybackRate(rate: number): void {
    this.videoElement.playbackRate = rate;
  }

  /**
   * Switches to the specified quality level.
   *
   * Setting `quality` to `'auto'` re-enables ABR by setting
   * `hls.currentLevel = -1`. For a named level the index is looked up in
   * `availableQualities` and written to `hls.currentLevel`.
   *
   * @param quality - Quality label (e.g. `'1080p'`) or `'auto'`.
   */
  setQuality(quality: string): void {
    if (!this.hls) return;

    if (quality === 'auto') {
      this.hls.currentLevel = -1;
    } else {
      const qualities = this.stateService.availableQualities();
      const index = qualities.indexOf(quality);
      if (index !== -1) this.hls.currentLevel = index;
    }
    this.stateService.setQuality(quality);
  }

  /**
   * Activates a subtitle track or disables all subtitles.
   *
   * Sets `hls.subtitleTrack` to the numeric track ID (enabling the track in
   * the hls.js subtitle pipeline) or to `-1` to disable subtitles.
   *
   * @param id - Track ID to activate, or `null` to disable.
   */
  setSubtitle(id: string | number | null): void {
    if (!this.hls) return;
    if (id === null) {
      this.hls.subtitleTrack = -1;
      this.stateService.setSubtitles(false);
      this.stateService.setActiveSubtitleId(null);
    } else {
      this.hls.subtitleTrack = Number(id);
      this.stateService.setSubtitles(true);
      this.stateService.setActiveSubtitleId(id);
    }
  }

  /**
   * Returns `true` after the HLS manifest has been parsed successfully
   * (or after `loadedmetadata` on the Safari native-HLS path).
   */
  isReady(): boolean {
    return this._isReady;
  }

  /**
   * Destroys the hls.js instance and removes all event listeners.
   *
   * The `AbortController` is aborted before `hls.destroy()` so that native
   * video events emitted during teardown do not reach the state service.
   */
  destroy(): void {
    this.abortController?.abort();
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    this._isReady = false;
  }
}
