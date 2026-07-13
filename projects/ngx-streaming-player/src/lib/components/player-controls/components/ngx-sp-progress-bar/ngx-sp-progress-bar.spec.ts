import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NgxSpProgressBar } from './ngx-sp-progress-bar';

describe('NgxSpProgressBar', () => {
  let component: NgxSpProgressBar;
  let fixture: ComponentFixture<NgxSpProgressBar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NgxSpProgressBar],
    }).compileComponents();

    fixture = TestBed.createComponent(NgxSpProgressBar);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('progressPercentage', 0);
    fixture.componentRef.setInput('bufferedPercentage', 0);
    fixture.componentRef.setInput('duration', 200);
    fixture.detectChanges();
    await fixture.whenStable();

    vi.spyOn(component.progressBar.nativeElement, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 200,
      bottom: 20,
      width: 200,
      height: 20,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
  });

  function mouseEvent(type: string, clientX: number): MouseEvent {
    return new MouseEvent(type, { clientX });
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('emits seek on click with the fractional position', () => {
    let emitted: number | undefined;
    component.seek.subscribe((v) => (emitted = v));

    component.onSeek(mouseEvent('click', 100));

    expect(emitted).toBe(0.5);
  });

  it('clamps the seek position to [0, 1]', () => {
    let emitted: number | undefined;
    component.seek.subscribe((v) => (emitted = v));

    component.onSeek(mouseEvent('click', -50));
    expect(emitted).toBe(0);

    component.onSeek(mouseEvent('click', 500));
    expect(emitted).toBe(1);
  });

  it('emits doubleClick on double-click', () => {
    let emitted = false;
    component.doubleClick.subscribe(() => (emitted = true));
    component.onDoubleClick();
    expect(emitted).toBe(true);
  });

  describe('drag interaction', () => {
    it('starts dragging and seeks on mousedown', () => {
      let emitted: number | undefined;
      component.seek.subscribe((v) => (emitted = v));

      component.onMouseDown(mouseEvent('mousedown', 50));

      expect(component.isDragging()).toBe(true);
      expect(emitted).toBe(0.25);
    });

    it('continues seeking via document mousemove while dragging', () => {
      component.onMouseDown(mouseEvent('mousedown', 0));

      let emitted: number | undefined;
      component.seek.subscribe((v) => (emitted = v));
      component.onDocumentMouseMove(mouseEvent('mousemove', 150));

      expect(emitted).toBe(0.75);
    });

    it('does not seek on document mousemove when not dragging', () => {
      let emitted = false;
      component.seek.subscribe(() => (emitted = true));
      component.onDocumentMouseMove(mouseEvent('mousemove', 150));
      expect(emitted).toBe(false);
    });

    it('ends the drag on mouseup', () => {
      component.onMouseDown(mouseEvent('mousedown', 50));
      expect(component.isDragging()).toBe(true);
      component.onMouseUp();
      expect(component.isDragging()).toBe(false);
    });

    it('mouseup is a no-op when not dragging', () => {
      expect(() => component.onMouseUp()).not.toThrow();
      expect(component.isDragging()).toBe(false);
    });
  });

  describe('hover state', () => {
    it('sets isHovering true on mouseenter', () => {
      component.onMouseEnter();
      expect(component.isHovering()).toBe(true);
    });

    it('updates hoverPercent and continues seeking on mousemove while dragging', () => {
      component.onMouseDown(mouseEvent('mousedown', 0));
      let emitted: number | undefined;
      component.seek.subscribe((v) => (emitted = v));

      component.onMouseMove(mouseEvent('mousemove', 100));

      expect(component.hoverPercent()).toBe(0.5);
      expect(emitted).toBe(0.5);
    });

    it('updates hoverPercent without seeking when not dragging', () => {
      let emitted = false;
      component.seek.subscribe(() => (emitted = true));

      component.onMouseMove(mouseEvent('mousemove', 60));

      expect(component.hoverPercent()).toBe(0.3);
      expect(emitted).toBe(false);
    });

    it('clears hover state on mouseleave when not dragging', () => {
      component.onMouseEnter();
      component.onMouseMove(mouseEvent('mousemove', 60));
      component.onMouseLeave();

      expect(component.isHovering()).toBe(false);
      expect(component.hoverPercent()).toBeNull();
    });

    it('keeps hover state on mouseleave while dragging', () => {
      component.onMouseDown(mouseEvent('mousedown', 60));
      component.onMouseLeave();

      expect(component.isDragging()).toBe(true);
    });
  });

  describe('hoverTime', () => {
    it('is null when hoverPercent is null', () => {
      expect(component.hoverTime()).toBeNull();
    });

    it('formats minutes:seconds for durations under an hour', () => {
      component.onMouseMove(mouseEvent('mousemove', 100)); // 0.5 * 200s = 100s
      expect(component.hoverTime()).toBe('01:40');
    });

    it('formats hours:minutes:seconds for durations over an hour', () => {
      fixture.componentRef.setInput('duration', 4000);
      fixture.detectChanges();
      component.onMouseMove(mouseEvent('mousemove', 200)); // fraction 1.0 * 4000s
      expect(component.hoverTime()).toBe('1:06:40');
    });
  });

  describe('onKeyDown', () => {
    function keyEvent(key: string): KeyboardEvent {
      return new KeyboardEvent('keydown', { key, cancelable: true });
    }

    it('steps back on ArrowLeft / ArrowDown', () => {
      fixture.componentRef.setInput('progressPercentage', 50);
      fixture.detectChanges();
      let emitted: number | undefined;
      component.seek.subscribe((v) => (emitted = v));

      component.onKeyDown(keyEvent('ArrowLeft'));
      expect(emitted).toBeCloseTo(0.45);

      component.onKeyDown(keyEvent('ArrowDown'));
      expect(emitted).toBeCloseTo(0.45);
    });

    it('steps forward on ArrowRight / ArrowUp', () => {
      fixture.componentRef.setInput('progressPercentage', 50);
      fixture.detectChanges();
      let emitted: number | undefined;
      component.seek.subscribe((v) => (emitted = v));

      component.onKeyDown(keyEvent('ArrowRight'));
      expect(emitted).toBeCloseTo(0.55);
    });

    it('jumps to start on Home and end on End', () => {
      fixture.componentRef.setInput('progressPercentage', 50);
      fixture.detectChanges();
      let emitted: number | undefined;
      component.seek.subscribe((v) => (emitted = v));

      component.onKeyDown(keyEvent('Home'));
      expect(emitted).toBe(0);

      component.onKeyDown(keyEvent('End'));
      expect(emitted).toBe(1);
    });

    it('clamps at the bounds', () => {
      fixture.componentRef.setInput('progressPercentage', 0);
      fixture.detectChanges();
      let emitted: number | undefined;
      component.seek.subscribe((v) => (emitted = v));

      component.onKeyDown(keyEvent('ArrowLeft'));
      expect(emitted).toBe(0);
    });

    it('ignores unrelated keys and does not emit', () => {
      let emitted = false;
      component.seek.subscribe(() => (emitted = true));
      const event = keyEvent('Tab');
      component.onKeyDown(event);
      expect(emitted).toBe(false);
      expect(event.defaultPrevented).toBe(false);
    });

    it('prevents default for handled keys', () => {
      const event = keyEvent('ArrowRight');
      component.onKeyDown(event);
      expect(event.defaultPrevented).toBe(true);
    });
  });

  it('exposes role=slider with aria-valuenow bound to progressPercentage', () => {
    fixture.componentRef.setInput('progressPercentage', 42);
    fixture.detectChanges();
    const bar = fixture.nativeElement.querySelector('.progress-bar') as HTMLElement;
    expect(bar.getAttribute('role')).toBe('slider');
    expect(bar.getAttribute('aria-valuenow')).toBe('42');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
  });
});
