import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { IntroChatRoomPageRoutingModule } from './intro-chat-room-routing.module';

import { IntroChatRoomPage } from './intro-chat-room.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    IntroChatRoomPageRoutingModule
  ],
  declarations: [IntroChatRoomPage]
})
export class IntroChatRoomPageModule {}
