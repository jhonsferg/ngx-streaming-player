import { Directive, ElementRef, NgZone, OnDestroy, OnInit, inject, signal } from '@angular/core';

/**
 * Observes the host element's visibility in the viewport.
 * Exposes `isVisible` as an Angular signal so the template can conditionally
 * mount the player only when the card is actually on screen - avoiding idle
 * HLS/DASH connections, video decoding and signal updates for off-screen players.
 *
 * Usage:
 *   <div lazyPlayer #lp="lazyPlayer">
 *     @if (lp.isVisible()) { <ngx-sp-player ...> }
 *   </div>
 *
 * rootMargin: 150px - start mounting slightly before the card enters the
 * viewport so the user never sees a blank frame when scrolling.
 */
@Directive({
  selector: '[appLazyPlayer]',
  standalone: true,
  exportAs: 'appLazyPlayer',
})
export class LazyPlayerDirective implements OnInit, OnDestroy {
  readonly isVisible = signal(false);

  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);
  private observer!: IntersectionObserver;

  ngOnInit(): void {
    // IntersectionObserver fires outside Angular's zone - wrap in zone.run()
    // so that signal writes correctly schedule change detection on Default-CD hosts.
    this.observer = new IntersectionObserver(
      ([entry]) => this.zone.run(() => this.isVisible.set(entry.isIntersecting)),
      { rootMargin: '150px 0px' },
    );
    this.observer.observe(this.el.nativeElement);
  }

  ngOnDestroy(): void {
    this.observer.disconnect();
  }
}
