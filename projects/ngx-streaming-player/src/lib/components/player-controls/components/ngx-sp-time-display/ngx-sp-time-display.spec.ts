import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NgxSpTimeDisplay } from './ngx-sp-time-display';

describe('NgxSpTimeDisplay', () => {
  let component: NgxSpTimeDisplay;
  let fixture: ComponentFixture<NgxSpTimeDisplay>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NgxSpTimeDisplay],
    }).compileComponents();

    fixture = TestBed.createComponent(NgxSpTimeDisplay);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('currentTime', '0:00');
    fixture.componentRef.setInput('duration', '0:00');
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
