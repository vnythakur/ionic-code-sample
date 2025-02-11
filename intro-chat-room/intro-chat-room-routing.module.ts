import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { IntroChatRoomPage } from './intro-chat-room.page';

const routes: Routes = [
  {
    path: '',
    component: IntroChatRoomPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class IntroChatRoomPageRoutingModule {}
