import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';

import { HelperService } from 'src/app/services/helper.service';
import { LoadingController, ModalController } from '@ionic/angular';
import { ApisService } from 'src/app/services/apis/apis.service';
import { LoggedinUser } from 'src/app/models/directline.model';
import { STATICNAME } from 'src/environments/environment';
import { Storage } from '@ionic/storage';
import { ForgotPasswordPage } from 'src/app/modals/forgot-password/forgot-password.page';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {
  loginForm: FormGroup;

  isSubmitted = false;

  constructor(
    private fb: FormBuilder,
    private apisService: ApisService,
    private storage: Storage,
    public helper: HelperService,
    public loadingCtrl: LoadingController,
    public router: Router,
    public modalCtrl: ModalController,
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
    });
  }

  ngOnInit() {
  }

  async onLogin() {
    this.isSubmitted = true;
    console.log(this.loginForm);

    if (this.loginForm.valid) {

      const loading = await this.loadingCtrl.create({
        message: 'Please wait...'
      });

      try {
        await loading.present();
        const resp: any = await this.apisService.loginUser(this.loginForm.value);
        console.log('resp : ', resp);

        const loggedInUserData = {
          conversationId: resp.userData[0].conversationId,
          email: resp.userData[0].email,
          password: resp.userData[0].password,
          firstName: resp.userData[0].firstName || '',
          lastName: resp.userData[0].lastName || '',
          child_data: resp.userData[0].child_data,
          parent_age_range: resp.userData[0].parent_age_range,
          parent_gender: resp.userData[0].parent_gender,
          zip_code: resp.userData[0].zip_code,
          occupation: resp.userData[0].occupation,
          ethnicityMaster: resp.userData[0].ethnicityMaster,
          ethnicityChild: resp.userData[0].ethnicityChild,
          convStartDate: resp.userData[0].convStartDate,
          convStartTime: resp.userData[0].convStartTime,
          convEndDate: resp.userData[0].convEndDate,
          convEndTime: resp.userData[0].convEndTime,
          registerCompleted: resp.userData[0].registerCompleted,
          id: resp.userData[0].id,
          registrationDate: resp.userData[0].registrationDate || '',
          registrationTime: resp.userData[0].registrationTime || '',
        } as LoggedinUser;
        console.log('loggedInUserData : ', loggedInUserData);
        await this.storage.set(STATICNAME.userData, loggedInUserData);
        await this.storage.set(STATICNAME.isIntroComplete, true);

        this.apisService.userData$.next(loggedInUserData);
        this.apisService.conversationData$.next({conversationId: resp.userData[0].conversationId});

        setTimeout(() => {
          this.loginForm.patchValue({email: '', password: ''});
          this.goto('chapter-list');
        }, 500);
        await loading.dismiss();
      } catch (error) {
        await loading.dismiss();
        console.log(error);
        this.helper.showToast(error.error.msg);
      }

    }
  }

  async showForgetPopup() {
    const modal = await this.modalCtrl.create({
      component: ForgotPasswordPage,
      cssClass: 'forgot-pass-modal-popup',
      swipeToClose: true,
    });
    modal.onDidDismiss().then(res => {
    });
    return await modal.present();
  }

  goto(url) {
    this.router.navigate([url]);
  }

}
