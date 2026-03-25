import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NgxSpTimeDisplay } from './ngx-sp-time-display';

describe('NgxSpTimeDisplay', () => {
  let component: NgxSpTimeDisplay;
  let fixture: ComponentFixture<NgxSpTimeDisplay>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NgxSpTimeDisplay]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NgxSpTimeDisplay);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
