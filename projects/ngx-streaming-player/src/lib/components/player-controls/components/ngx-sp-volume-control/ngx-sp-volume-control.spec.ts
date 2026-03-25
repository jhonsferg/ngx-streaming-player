import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NgxSpVolumeControl } from './ngx-sp-volume-control';

describe('NgxSpVolumeControl', () => {
  let component: NgxSpVolumeControl;
  let fixture: ComponentFixture<NgxSpVolumeControl>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NgxSpVolumeControl]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NgxSpVolumeControl);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
