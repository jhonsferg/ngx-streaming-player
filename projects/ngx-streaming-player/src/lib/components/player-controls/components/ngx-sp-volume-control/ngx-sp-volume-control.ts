import { Component, input, output, signal, computed } from '@angular/core';

/**
 * Combined mute-toggle button and volume slider control.
 *
 * Renders a mute/unmute icon button next to a custom-styled range input.
 * The slider track fill is driven by the CSS custom property `--vol`, which
 * is updated inline as the volume signal changes, allowing a pure-CSS gradient
 * fill without JavaScript DOM manipulation.
 *
 * ### Mute button ripple
 * Clicking the mute icon triggers a 500 ms ripple animation (via
 * `rippleActive`) before emitting the `toggleMute` output.
 *
 * ### Volume badge
 * A percentage badge (`volumePct`) appears on hover or while dragging to give
 * precise numeric feedback. It is hidden via CSS when neither state is active.
 *
 * @example
 * <ngx-sp-volume-control
 *   [volume]="stateService.volume()"
 *   [isMuted]="stateService.muted()"
 *   (volumeChange)="setVolume($event)"
 *   (toggleMute)="toggleMute()"
 * ></ngx-sp-volume-control>
 */
@Component({
  selector: 'ngx-sp-volume-control',
  standalone: true,
  imports: [],
  templateUrl: './ngx-sp-volume-control.html',
  styleUrls: ['./ngx-sp-volume-control.scss'],
})
export class NgxSpVolumeControl {
  /**
   * Current volume level in the range `[0, 1]`.
   * Bound to the range input value and used to compute `volumePct`.
   */
  volume = input.required<number>();

  /**
   * Whether audio is currently muted.
   * Controls the icon displayed on the mute button (muted vs. unmuted icon).
   */
  isMuted = input.required<boolean>();

  /**
   * Emitted when the user moves the volume slider.
   * Payload is the new volume as a `number` in the range `[0, 1]`.
   *
   * @example
   * (volumeChange)="playerService.setVolume($event)"
   */
  volumeChange = output<number>();

  /**
   * Emitted when the user clicks the mute/unmute icon button.
   * The parent component decides the actual mute-toggle logic.
   *
   * @example
   * (toggleMute)="playerService.setMuted(!stateService.muted())"
   */
  toggleMute = output<void>();

  /**
   * `true` while the mute-button ripple animation is playing (500 ms).
   * Drives the `[class.active]` binding on the ripple element in the template.
   */
  readonly rippleActive = signal(false);

  /**
   * Current volume rounded to the nearest integer percentage (`0–100`).
   * Displayed in the hover badge.
   *
   * @example
   * // volume = 0.73  →  volumePct = 73
   */
  readonly volumePct = computed(() => Math.round(this.volume() * 100));

  /** @internal Timer ID for resetting `rippleActive` after 500 ms. */
  private rippleTimer: any;

  /**
   * Handles input events from the range slider.
   *
   * Parses the string value to a float and emits it via `volumeChange`.
   *
   * @param event - The native `input` event from the `<input type="range">`.
   */
  onVolumeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.volumeChange.emit(Number(input.value));
  }

  /**
   * Handles a click on the mute icon button.
   *
   * Triggers the ripple animation for 500 ms, then emits `toggleMute`.
   * An existing timer is cleared before each activation so rapid clicks
   * do not stack multiple animation cycles.
   */
  onToggleMute(): void {
    if (this.rippleTimer) clearTimeout(this.rippleTimer);
    this.rippleActive.set(true);
    this.rippleTimer = setTimeout(() => this.rippleActive.set(false), 500);
    this.toggleMute.emit();
  }
}
