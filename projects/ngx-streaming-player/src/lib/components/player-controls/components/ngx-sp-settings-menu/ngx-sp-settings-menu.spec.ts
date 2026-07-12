import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NgxSpSettingsMenu } from './ngx-sp-settings-menu';

describe('NgxSpSettingsMenu', () => {
  let component: NgxSpSettingsMenu;
  let fixture: ComponentFixture<NgxSpSettingsMenu>;

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
});
