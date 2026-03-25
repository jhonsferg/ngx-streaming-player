import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NgxSpSettingsMenu } from './ngx-sp-settings-menu';

describe('NgxSpSettingsMenu', () => {
  let component: NgxSpSettingsMenu;
  let fixture: ComponentFixture<NgxSpSettingsMenu>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NgxSpSettingsMenu]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NgxSpSettingsMenu);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
