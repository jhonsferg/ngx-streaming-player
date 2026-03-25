import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NgxSpProgressBar } from './ngx-sp-progress-bar';

describe('NgxSpProgressBar', () => {
  let component: NgxSpProgressBar;
  let fixture: ComponentFixture<NgxSpProgressBar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NgxSpProgressBar]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NgxSpProgressBar);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
