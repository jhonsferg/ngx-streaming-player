import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Generic icon button with a CSS ripple effect and an optional tooltip.
 *
 * `NgxSpButton` is a low-level building block used by `PlayerControlsComponent`
 * for every clickable action in the controls bar (play/pause, skip, fullscreen,
 * PiP, subtitle toggle, etc.). It wraps the actual click logic in a ripple
 * handler that positions the ink animation at the exact cursor coordinates
 * before forwarding the event via the `clicked` output.
 *
 * ### Customisation
 * Pass one or more modifier class names via `[modifierClass]` to apply
 * BEM-style variant styles defined in the component stylesheet:
 *
 * | Modifier class        | Appearance                              |
 * |-----------------------|-----------------------------------------|
 * | `sp-btn--play-pause`  | Larger hit area for play/pause          |
 * | `sp-btn--skip`        | Skip-backward / skip-forward style      |
 * | `sp-btn--active`      | Highlighted state (e.g. subtitles on)   |
 * | `sp-btn--pip-active`  | PiP-active highlight                    |
 *
 * @example
 * <!-- Play / pause button -->
 * <ngx-sp-button
 *   modifierClass="sp-btn--play-pause"
 *   tooltipText="Play"
 *   (clicked)="togglePlay()"
 * >
 *   <span class="material-icons">play_arrow</span>
 * </ngx-sp-button>
 *
 * @example
 * <!-- Active-state toggle (e.g. subtitles enabled) -->
 * <ngx-sp-button
 *   [modifierClass]="subtitlesEnabled ? 'sp-btn--active' : ''"
 *   tooltipText="Subtitles"
 *   (clicked)="toggleSubtitles()"
 * >
 *   <span class="material-icons">subtitles</span>
 * </ngx-sp-button>
 */
@Component({
  selector: 'ngx-sp-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ngx-sp-button.html',
  styleUrls: ['./ngx-sp-button.scss'],
})
export class NgxSpButton {
  /**
   * One or more space-separated BEM modifier class names appended to the
   * `.sp-btn` base class on the host button element.
   *
   * @default ''
   */
  modifierClass = input<string>('');

  /**
   * Text displayed in the tooltip that appears on hover.
   * Pass an empty string to suppress the tooltip entirely.
   *
   * @default ''
   */
  tooltipText = input<string>('');

  /**
   * Emitted when the button is clicked, after the ripple animation is
   * triggered. The native `MouseEvent` is forwarded unchanged.
   */
  clicked = output<MouseEvent>();

  /**
   * `true` while the ripple animation is running (600 ms window).
   * Drives the `[class.active]` binding on the ripple `<span>`.
   */
  readonly rippleActive = signal(false);

  /**
   * Pixel coordinates of the ripple origin relative to the button element.
   * Set from the `clientX` / `clientY` of the mouse event so the ink
   * expands from the exact click point.
   */
  readonly ripplePos = signal({ x: 0, y: 0 });

  /** @internal Timer ID used to reset `rippleActive` after 600 ms. */
  private rippleTimer: any;

  /**
   * Handles a click on the button element.
   *
   * Steps:
   * 1. Calculates the cursor position relative to the button bounds.
   * 2. Cancels any still-running ripple timer.
   * 3. Positions and activates the ripple animation.
   * 4. Schedules ripple deactivation after 600 ms.
   * 5. Emits the `clicked` output with the original event.
   *
   * @param event - The native `MouseEvent` from the button click.
   */
  handleClick(event: MouseEvent): void {
    const el = event.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    this.ripplePos.set({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
    if (this.rippleTimer) clearTimeout(this.rippleTimer);
    this.rippleActive.set(true);
    this.rippleTimer = setTimeout(() => this.rippleActive.set(false), 600);
    this.clicked.emit(event);
  }
}
