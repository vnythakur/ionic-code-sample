import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { IntroChatRoomPage } from './intro-chat-room.page';

describe('IntroChatRoomPage', () => {
  let component: IntroChatRoomPage;
  let fixture: ComponentFixture<IntroChatRoomPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ IntroChatRoomPage ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(IntroChatRoomPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
