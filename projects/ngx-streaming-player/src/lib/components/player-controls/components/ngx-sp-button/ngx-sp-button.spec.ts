import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NgxSpButton } from './ngx-sp-button';

describe('NgxSpButton', () => {
  let component: NgxSpButton;
  let fixture: ComponentFixture<NgxSpButton>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NgxSpButton],
    }).compileComponents();

    fixture = TestBed.createComponent(NgxSpButton);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  function makeClickEvent(el: HTMLElement, x: number, y: number): MouseEvent {
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      left: 10,
      top: 20,
      right: 110,
      bottom: 60,
      width: 100,
      height: 40,
      x: 10,
      y: 20,
      toJSON: () => ({}),
    } as DOMRect);
    return new MouseEvent('click', { clientX: x, clientY: y });
  }

  it('positions the ripple relative to the button bounds and activates it', () => {
    const button = fixture.nativeElement.querySelector('button') as HTMLElement;
    const event = makeClickEvent(button, 50, 40);
    Object.defineProperty(event, 'currentTarget', { value: button });

    component.handleClick(event);

    expect(component.ripplePos()).toEqual({ x: 40, y: 20 });
    expect(component.rippleActive()).toBe(true);
  });

  it('emits the clicked output with the original event', () => {
    const button = fixture.nativeElement.querySelector('button') as HTMLElement;
    const event = makeClickEvent(button, 5, 5);
    Object.defineProperty(event, 'currentTarget', { value: button });

    let emitted: MouseEvent | undefined;
    component.clicked.subscribe((e) => (emitted = e));

    component.handleClick(event);

    expect(emitted).toBe(event);
  });

  it('deactivates the ripple after 600ms', () => {
    vi.useFakeTimers();
    const button = fixture.nativeElement.querySelector('button') as HTMLElement;
    const event = makeClickEvent(button, 5, 5);
    Object.defineProperty(event, 'currentTarget', { value: button });

    component.handleClick(event);
    expect(component.rippleActive()).toBe(true);

    vi.advanceTimersByTime(600);
    expect(component.rippleActive()).toBe(false);
  });

  it('clears a still-running ripple timer on rapid consecutive clicks', () => {
    vi.useFakeTimers();
    const button = fixture.nativeElement.querySelector('button') as HTMLElement;
    const event1 = makeClickEvent(button, 5, 5);
    Object.defineProperty(event1, 'currentTarget', { value: button });
    const event2 = makeClickEvent(button, 15, 15);
    Object.defineProperty(event2, 'currentTarget', { value: button });

    component.handleClick(event1);
    vi.advanceTimersByTime(300);
    component.handleClick(event2);
    vi.advanceTimersByTime(300);

    // The first timer would have fired at 600ms total, but was cleared by
    // the second click at 300ms, so the ripple should still be active here.
    expect(component.rippleActive()).toBe(true);

    vi.advanceTimersByTime(300);
    expect(component.rippleActive()).toBe(false);
  });

  it('renders the tooltip text and testId as DOM attributes', () => {
    fixture.componentRef.setInput('tooltipText', 'Play');
    fixture.componentRef.setInput('testId', 'ngx-sp-play-toggle');
    fixture.componentRef.setInput('modifierClass', 'sp-btn--play-pause');
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button') as HTMLElement;
    expect(button.getAttribute('data-testid')).toBe('ngx-sp-play-toggle');
    expect(button.className).toContain('sp-btn--play-pause');
  });
});
