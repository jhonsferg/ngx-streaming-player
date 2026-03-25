import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NgxSpButton } from './ngx-sp-button';

describe('NgxSpButton', () => {
  let component: NgxSpButton;
  let fixture: ComponentFixture<NgxSpButton>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NgxSpButton]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NgxSpButton);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
