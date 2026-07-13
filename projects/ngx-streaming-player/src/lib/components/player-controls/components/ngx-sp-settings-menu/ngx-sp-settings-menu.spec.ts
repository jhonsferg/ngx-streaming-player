import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NgxSpSettingsMenu } from './ngx-sp-settings-menu';
import { SubtitleTrack } from '../../../../models/player.models';

describe('NgxSpSettingsMenu', () => {
  let component: NgxSpSettingsMenu;
  let fixture: ComponentFixture<NgxSpSettingsMenu>;

  const subtitles: SubtitleTrack[] = [
    { id: 'en', label: 'English', language: 'en' },
    { id: 'es', label: '', language: 'es' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NgxSpSettingsMenu],
    }).compileComponents();

    fixture = TestBed.createComponent(NgxSpSettingsMenu);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('showSettingsMenu', false);
    fixture.componentRef.setInput('activeMenu', 'main');
    fixture.componentRef.setInput('playbackRate', 1);
    fixture.componentRef.setInput('currentQuality', 'auto');
    fixture.componentRef.setInput('supportsSubtitles', false);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('quality helpers', () => {
    it('capitalises the auto label', () => {
      expect(component.getQualityLabel('auto')).toBe('Auto');
    });

    it('returns other quality strings unchanged', () => {
      expect(component.getQualityLabel('1080p')).toBe('1080p');
    });

    it('isAutoQuality reflects the current quality input', () => {
      fixture.componentRef.setInput('currentQuality', 'auto');
      fixture.detectChanges();
      expect(component.isAutoQuality()).toBe(true);

      fixture.componentRef.setInput('currentQuality', '720p');
      fixture.detectChanges();
      expect(component.isAutoQuality()).toBe(false);
    });

    it('isActiveQuality matches plain string levels', () => {
      fixture.componentRef.setInput('currentQuality', '720p');
      fixture.detectChanges();
      expect(component.isActiveQuality('720p')).toBe(true);
      expect(component.isActiveQuality('1080p')).toBe(false);
    });

    it('isActiveQuality matches level objects by height or id', () => {
      fixture.componentRef.setInput('currentQuality', '720p');
      fixture.detectChanges();
      expect(component.isActiveQuality({ height: 720 })).toBe(true);

      fixture.componentRef.setInput('currentQuality', '5');
      fixture.detectChanges();
      expect(component.isActiveQuality({ id: 5 })).toBe(true);
    });

    it('getLevelLabel handles auto, strings, height and bitrate objects', () => {
      expect(component.getLevelLabel('auto')).toBe(component.i18n().auto);
      expect(component.getLevelLabel('custom')).toBe('custom');
      expect(component.getLevelLabel({ height: 480 })).toBe('480p');
      expect(component.getLevelLabel({ bitrate: 2500000 })).toBe('2500kbps');
      expect(component.getLevelLabel({})).toBe('Unknown');
    });

    it('onSetQualityObject normalises string labels', () => {
      let emitted: string | undefined;
      component.setQuality.subscribe((q) => (emitted = q));
      component.onSetQualityObject('1080p');
      expect(emitted).toBe('1080p');
    });

    it('onSetQualityObject normalises level objects by id or height', () => {
      let emitted: string | undefined;
      component.setQuality.subscribe((q) => (emitted = q));
      component.onSetQualityObject({ id: 7 });
      expect(emitted).toBe('7');

      component.onSetQualityObject({ height: 360 });
      expect(emitted).toBe('360');
    });
  });

  describe('subtitle helpers', () => {
    it('getSubtitleLabel returns the off label when no active id', () => {
      fixture.componentRef.setInput('activeSubtitleId', null);
      fixture.detectChanges();
      expect(component.getSubtitleLabel()).toBe(component.i18n().subtitlesOff);
    });

    it('getSubtitleLabel returns the matching track label', () => {
      fixture.componentRef.setInput('availableSubtitles', subtitles);
      fixture.componentRef.setInput('activeSubtitleId', 'en');
      fixture.detectChanges();
      expect(component.getSubtitleLabel()).toBe('English');
    });

    // getSubtitleLabel uses `??` (not `||`) so a legitimate-but-falsy label
    // (e.g. an empty string) is rendered as-is rather than being masked by
    // the fallback - only a missing/undefined match falls back.
    it('renders an empty (but present) track label as-is, not the fallback', () => {
      fixture.componentRef.setInput('availableSubtitles', subtitles);
      fixture.componentRef.setInput('activeSubtitleId', 'es');
      fixture.detectChanges();
      expect(component.getSubtitleLabel()).toBe('');
    });

    it('getSubtitleLabel falls back to the enabled label when active but unmatched', () => {
      fixture.componentRef.setInput('availableSubtitles', subtitles);
      fixture.componentRef.setInput('activeSubtitleId', 'fr');
      fixture.detectChanges();
      expect(component.getSubtitleLabel()).toBe(component.i18n().subtitlesEnabled);
    });

    it('isActiveSubtitle matches by id', () => {
      fixture.componentRef.setInput('activeSubtitleId', 'en');
      fixture.detectChanges();
      expect(component.isActiveSubtitle(subtitles[0])).toBe(true);
      expect(component.isActiveSubtitle(subtitles[1])).toBe(false);
    });

    it('isActiveSubtitle is false when no active id', () => {
      fixture.componentRef.setInput('activeSubtitleId', null);
      fixture.detectChanges();
      expect(component.isActiveSubtitle(subtitles[0])).toBe(false);
    });
  });

  describe('output emitters', () => {
    it('onSetMenuVisibility emits setMenuVisibility', () => {
      let emitted: boolean | undefined;
      component.setMenuVisibility.subscribe((v) => (emitted = v));
      component.onSetMenuVisibility(true);
      expect(emitted).toBe(true);
    });

    it('onNavigateMenu emits navigateMenu', () => {
      let emitted: string | undefined;
      component.navigateMenu.subscribe((v) => (emitted = v));
      component.onNavigateMenu('quality');
      expect(emitted).toBe('quality');
    });

    it('onNavigateMenuTyped emits navigateMenu', () => {
      let emitted: string | undefined;
      component.navigateMenu.subscribe((v) => (emitted = v));
      component.onNavigateMenuTyped('speed');
      expect(emitted).toBe('speed');
    });

    it('onSetSpeed emits setSpeed', () => {
      let emitted: number | undefined;
      component.setSpeed.subscribe((v) => (emitted = v));
      component.onSetSpeed(1.5);
      expect(emitted).toBe(1.5);
    });

    it('onSetSubtitle emits setSubtitle', () => {
      let emitted: string | number | null | undefined;
      component.setSubtitle.subscribe((v) => (emitted = v));
      component.onSetSubtitle('en');
      expect(emitted).toBe('en');
      component.onSetSubtitle(null);
      expect(emitted).toBeNull();
    });
  });

  // NOTE: the settings panel views carry an `@slideView` animation trigger
  // in the template, but this project does not depend on @angular/animations
  // and never registers a `slideView` trigger or an animations provider
  // (provideAnimations/provideNoopAnimations). Rendering the panel open
  // (showSettingsMenu=true) therefore throws NG05105 ("Unexpected synthetic
  // property @slideView found") under TestBed's strict renderer - a
  // pre-existing gap in the animation wiring, out of scope for this pass.
  // DOM-level assertions here are limited to the closed-panel state; the
  // open-panel branches are covered above at the component-method level
  // (onNavigateMenu, onSetQualityObject, onSetSpeed, onSetSubtitle, etc.).
  describe('template rendering (closed state)', () => {
    it('does not render the panel when showSettingsMenu is false', () => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.settings-panel')).toBeNull();
    });

    it('clicking the trigger button toggles the panel via setMenuVisibility', () => {
      let emitted: boolean | undefined;
      component.setMenuVisibility.subscribe((v) => (emitted = v));
      fixture.detectChanges();
      const trigger = fixture.nativeElement.querySelector(
        '.settings-wrap__trigger',
      ) as HTMLButtonElement;
      trigger.click();
      expect(emitted).toBe(true);
    });
  });
});
