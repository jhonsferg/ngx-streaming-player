import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NgxSpVolumeControl } from './ngx-sp-volume-control';

describe('NgxSpVolumeControl', () => {
  let component: NgxSpVolumeControl;
  let fixture: ComponentFixture<NgxSpVolumeControl>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NgxSpVolumeControl],
    }).compileComponents();

    fixture = TestBed.createComponent(NgxSpVolumeControl);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('volume', 1);
    fixture.componentRef.setInput('isMuted', false);
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('computes volumePct as a rounded percentage', () => {
    fixture.componentRef.setInput('volume', 0.734);
    fixture.detectChanges();
    expect(component.volumePct()).toBe(73);
  });

  it('emits volumeChange with the parsed slider value', () => {
    let emitted: number | undefined;
    component.volumeChange.subscribe((v) => (emitted = v));

    const input = document.createElement('input');
    input.value = '0.42';
    component.onVolumeInput({ target: input } as unknown as Event);

    expect(emitted).toBe(0.42);
  });

  it('triggers the ripple and emits toggleMute on mute-button click', () => {
    vi.useFakeTimers();
    let toggled = false;
    component.toggleMute.subscribe(() => (toggled = true));

    component.onToggleMute();

    expect(component.rippleActive()).toBe(true);
    expect(toggled).toBe(true);

    vi.advanceTimersByTime(500);
    expect(component.rippleActive()).toBe(false);
  });

  it('clears a still-running ripple timer on rapid toggles', () => {
    vi.useFakeTimers();
    component.onToggleMute();
    vi.advanceTimersByTime(250);
    component.onToggleMute();
    vi.advanceTimersByTime(250);

    expect(component.rippleActive()).toBe(true);

    vi.advanceTimersByTime(250);
    expect(component.rippleActive()).toBe(false);
  });

  it('renders the muted icon when isMuted is true', () => {
    fixture.componentRef.setInput('isMuted', true);
    fixture.detectChanges();
    const icon = fixture.nativeElement.querySelector('.icon--muted');
    expect(icon).toBeTruthy();
  });

  it('renders the muted icon when volume is 0 even if not muted', () => {
    fixture.componentRef.setInput('volume', 0);
    fixture.detectChanges();
    const icon = fixture.nativeElement.querySelector('.icon--muted');
    expect(icon).toBeTruthy();
  });

  it('applies the volume-wrap--muted class when muted', () => {
    fixture.componentRef.setInput('isMuted', true);
    fixture.detectChanges();
    const wrap = fixture.nativeElement.querySelector('.volume-wrap');
    expect(wrap.classList.contains('volume-wrap--muted')).toBe(true);
  });

  it('sets the range input value to 0 while muted regardless of volume', () => {
    fixture.componentRef.setInput('volume', 0.8);
    fixture.componentRef.setInput('isMuted', true);
    fixture.detectChanges();
    const range = fixture.nativeElement.querySelector('input[type="range"]') as HTMLInputElement;
    expect(range.value).toBe('0');
  });

  it('clicking the mute button invokes onToggleMute via the template', () => {
    const spy = vi.spyOn(component, 'onToggleMute');
    const btn = fixture.nativeElement.querySelector('.volume-wrap__icon-btn') as HTMLButtonElement;
    btn.click();
    expect(spy).toHaveBeenCalled();
  });
});
