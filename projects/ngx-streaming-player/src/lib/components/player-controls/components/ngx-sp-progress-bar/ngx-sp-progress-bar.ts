import {
  Component,
  input,
  output,
  signal,
  computed,
  ElementRef,
  ViewChild,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Seekable progress bar with a hover-time tooltip and a buffered indicator.
 *
 * The bar consists of three stacked layers:
 * 1. **Buffered track** - grey fill representing pre-loaded data.
 * 2. **Played track** - primary-colour fill for the portion already watched.
 * 3. **Ghost track** - semi-transparent preview of the cursor position.
 * 4. **Drag handle** - small circle at the current play position.
 *
 * ### Drag behaviour
 * Drag is initiated on `mousedown` inside the bar and continues even if the
 * cursor leaves the element, thanks to a `document:mousemove` `HostListener`.
 * The drag ends on `document:mouseup`. This prevents the seek from stopping
 * mid-drag when the user moves the cursor quickly.
 *
 * ### Hover tooltip
 * While the cursor hovers over the bar, a formatted time tooltip is shown
 * above the cursor position. The tooltip time is computed from `hoverPercent`
 * and the `duration` input using the private `formatTime()` helper.
 *
 * @example
 * <ngx-sp-progress-bar
 *   [progressPercentage]="stateService.progress()"
 *   [bufferedPercentage]="stateService.bufferedPercentage()"
 *   [duration]="stateService.duration()"
 *   (seek)="onSeek($event)"
 *   (doubleClick)="onDoubleClick()"
 * ></ngx-sp-progress-bar>
 */
@Component({
  selector: 'ngx-sp-progress-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ngx-sp-progress-bar.html',
  styleUrls: ['./ngx-sp-progress-bar.scss'],
})
export class NgxSpProgressBar {
  /**
   * Played percentage in the range `[0, 100]`.
   * Maps directly to `PlayerStateService.progress()`.
   */
  progressPercentage = input.required<number>();

  /**
   * Buffered (pre-loaded) percentage in the range `[0, 100]`.
   * Maps directly to `PlayerStateService.bufferedPercentage()`.
   */
  bufferedPercentage = input.required<number>();

  /**
   * Total media duration in seconds, used to compute the hover tooltip time.
   * @default 0
   */
  duration = input<number>(0);

  /**
   * Emitted when the user clicks or drags to a new position.
   * The payload is the fractional position in the range `[0, 1]`.
   *
   * @example
   * (seek)="playerService.seek($event * stateService.duration())"
   */
  seek = output<number>();

  /**
   * Emitted on a double-click over the progress bar.
   * `PlayerControlsComponent` uses this to trigger fullscreen.
   */
  doubleClick = output<void>();

  /** Reference to the `.progress-bar` div used for bounds calculations. */
  @ViewChild('progressBar') progressBar!: ElementRef<HTMLDivElement>;

  /**
   * `true` while the user is holding the mouse button down on the bar.
   * Activates the document-level `mousemove` listener for out-of-bounds drag.
   */
  readonly isDragging = signal(false);

  /**
   * Current cursor position as a fraction `[0, 1]` while hovering.
   * `null` when the cursor is not over the bar and no drag is active.
   */
  readonly hoverPercent = signal<number | null>(null);

  /** `true` when the cursor is inside the progress bar element. */
  readonly isHovering = signal(false);

  /**
   * Formatted time string shown in the hover tooltip.
   * Derived from `hoverPercent * duration` via `formatTime()`.
   * Returns `null` when `hoverPercent` is `null`.
   *
   * @example
   * // hoverPercent = 0.25, duration = 240  →  "01:00"
   */
  readonly hoverTime = computed(() => {
    const p = this.hoverPercent();
    if (p === null) return null;
    return this.formatTime(p * this.duration());
  });

  // -- Mouse event handlers --------------------------------------------------

  /**
   * Begins a drag-seek on `mousedown`.
   *
   * @param event - The `mousedown` event on the progress bar.
   */
  onMouseDown(event: MouseEvent): void {
    this.isDragging.set(true);
    this.seekTo(event);
  }

  /** Sets `isHovering` to `true` when the cursor enters the bar. */
  onMouseEnter(): void {
    this.isHovering.set(true);
  }

  /**
   * Updates the hover tooltip position and continues a drag-seek while the
   * cursor moves inside the bar.
   *
   * @param event - The `mousemove` event inside the bar.
   */
  onMouseMove(event: MouseEvent): void {
    this.updateHoverPercent(event);
    if (this.isDragging()) {
      this.seekTo(event);
    }
  }

  /**
   * Clears hover state when the cursor leaves the bar, unless a drag is
   * in progress (the drag continues via the document-level listener).
   */
  onMouseLeave(): void {
    if (!this.isDragging()) {
      this.hoverPercent.set(null);
      this.isHovering.set(false);
    }
  }

  /**
   * Continues the seek while the mouse is dragged outside the bar bounds.
   * Listens on `document` so the seek does not stop at the bar edge.
   *
   * @param event - The `mousemove` event from the document.
   */
  @HostListener('document:mousemove', ['$event'])
  onDocumentMouseMove(event: MouseEvent): void {
    if (this.isDragging()) {
      this.seekTo(event);
    }
  }

  /**
   * Ends a drag-seek on `mouseup`, regardless of cursor position.
   * Listens on `document` to catch releases that occur outside the bar.
   */
  @HostListener('document:mouseup')
  onMouseUp(): void {
    if (this.isDragging()) {
      this.isDragging.set(false);
    }
  }

  /**
   * Handles a single click on the progress bar (non-drag seek).
   *
   * @param event - The `click` event.
   */
  onSeek(event: MouseEvent): void {
    this.seekTo(event);
  }

  /** Emits `doubleClick` output when the bar is double-clicked. */
  onDoubleClick(): void {
    this.doubleClick.emit();
  }

  // -- Private helpers -------------------------------------------------------

  /**
   * Computes the fractional hover position from a mouse event and stores it
   * in `hoverPercent`, clamped to `[0, 1]`.
   *
   * @param event - Any mouse event with `clientX`.
   */
  private updateHoverPercent(event: MouseEvent): void {
    if (!this.progressBar) return;
    const rect = this.progressBar.nativeElement.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    this.hoverPercent.set(pos);
  }

  /**
   * Calculates the fractional seek position from a mouse event and emits
   * it via the `seek` output, clamped to `[0, 1]`.
   *
   * @param event - Any mouse event with `clientX`.
   */
  private seekTo(event: MouseEvent): void {
    if (!this.progressBar) return;
    const rect = this.progressBar.nativeElement.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    this.seek.emit(pos);
  }

  /**
   * Converts seconds to a compact time string.
   *
   * @param seconds - Duration in seconds.
   * @returns `'m:ss'` for durations under one hour, `'h:mm:ss'` otherwise.
   *   Returns `'0:00'` for negative or non-finite values.
   */
  private formatTime(seconds: number): string {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }
}
