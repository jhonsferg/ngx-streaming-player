import { Component, input } from '@angular/core';

/**
 * Compact time display showing the current playback position and total duration.
 *
 * Renders two pre-formatted strings separated by a `/` divider. Both values
 * are produced by `PlayerStateService.formattedCurrentTime()` and
 * `PlayerStateService.formattedDuration()` and forwarded by
 * `PlayerControlsComponent` as required inputs.
 *
 * The current-time value is displayed at full opacity; the duration is
 * rendered at 45 % opacity to create a visual hierarchy — matching the
 * convention used by YouTube and other major video players.
 *
 * @example
 * <!-- Inside PlayerControlsComponent template -->
 * <ngx-sp-time-display
 *   [currentTime]="stateService.formattedCurrentTime()"
 *   [duration]="stateService.formattedDuration()"
 * ></ngx-sp-time-display>
 *
 * @example
 * <!-- Renders as: "01:23 / 10:00" -->
 */
@Component({
  selector: 'ngx-sp-time-display',
  standalone: true,
  imports: [],
  templateUrl: './ngx-sp-time-display.html',
  styleUrls: ['./ngx-sp-time-display.scss'],
})
export class NgxSpTimeDisplay {
  /**
   * Current playback position as a pre-formatted string.
   *
   * Expected format: `'mm:ss'` for durations under one hour,
   * `'h:mm:ss'` for one hour or longer (e.g. `'01:23'`, `'1:02:03'`).
   */
  currentTime = input.required<string>();

  /**
   * Total media duration as a pre-formatted string.
   *
   * Expected format: `'mm:ss'` or `'h:mm:ss'`. Displays `'00:00'` when
   * metadata has not yet loaded.
   */
  duration = input.required<string>();
}
