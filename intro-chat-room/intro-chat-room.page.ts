import { Component, OnInit, ViewChild, NgZone, OnDestroy, ElementRef } from '@angular/core';
import { ApisService } from 'src/app/services/apis/apis.service';
import { Subscription, Subject } from 'rxjs';
import { IonContent, Platform, ModalController, IonInfiniteScroll, AlertController } from '@ionic/angular';
import { Router, ActivatedRoute } from '@angular/router';
import { TextToSpeech } from '@ionic-native/text-to-speech/ngx';
import { SpeechRecognition, SpeechRecognitionListeningOptionsAndroid, SpeechRecognitionListeningOptionsIOS } from '@ionic-native/speech-recognition/ngx';
import { HelperService } from 'src/app/services/helper.service';
import { Storage } from '@ionic/storage';

import { STATICNAME } from '../../../environments/environment';
import { Activity, VideoFormat } from 'src/app/models/directline.model';
import moment from 'moment';

import {takeUntil} from 'rxjs/operators';
import { FeedbackModalPage } from 'src/app/modals/feedback-modal/feedback-modal.page';
import { VideoPlayerPage } from 'src/app/modals/video-player/video-player.page';
import { DomSanitizer } from '@angular/platform-browser';
import { Geolocation } from '@ionic-native/geolocation/ngx';
import { NativeGeocoder, NativeGeocoderResult, NativeGeocoderOptions } from '@ionic-native/native-geocoder/ngx';
import { HttpErrorResponse } from '@angular/common/http';
import { LocationMessagePage } from 'src/app/modals/location-message/location-message.page';
import { Network } from '@ionic-native/network/ngx';

// declare var TestFairy: any;

@Component({
  selector: 'app-intro-chat-room',
  templateUrl: './intro-chat-room.page.html',
  styleUrls: ['./intro-chat-room.page.scss'],
})
export class IntroChatRoomPage implements OnInit, OnDestroy {
  @ViewChild(IonContent, {static: true}) content: IonContent;
  @ViewChild(IonInfiniteScroll, {static: true}) infiniteScroll: IonInfiniteScroll;

  onDestroy$ = new Subject<any>();

  conversationId: string;
  streamUrl: string;
  botSubRef: Subscription;
  message: string;
  allMessages = [];
  allOldMessages = [];
  allNewMessages = [];
  predictiveTextArr = [];
  isBotTyping = true;
  enterBtn = '';
  selectedMsgCls = '';
  talkingToTeddi = false;
  isBotInitialized = false;

  offset = 0;
  limit = 25;

  chapterType = '';

  showScrollBottomBtn = false;
  pixelScrollTop = 0;
  pixelScrollBottom = 0;
  tempPixelField = 0;

  sendBtnDisabled = true;

  botTimeoutListener = null;

  isGeoLocationCheckDone = false;

  /* timeoutRef = null; */

  constructor(
    private apisService: ApisService,
    private router: Router,
    private tts: TextToSpeech,
    private speechRecognition: SpeechRecognition,
    public helper: HelperService,
    public plt: Platform,
    public storage: Storage,
    private _ngZone: NgZone,
    private modalCtrl: ModalController,
    private _activateRoute: ActivatedRoute,
    private alertCtrl: AlertController,
    private sanitizer: DomSanitizer,
    private geolocation: Geolocation,
    private nativeGeocoder: NativeGeocoder,
    private network: Network,
  ) {

  }

  ngOnInit() {

    this.network.onConnect().subscribe(() => {
      console.log('Chat Screen : Internet Connected');
      setTimeout(() => {
        this.refreshStreamURlAndConnect();
      }, 2000);
    });

  }
  ngOnDestroy() {
    this.onDestroy$.next(null);
  }

  ionViewWillEnter() {
    this.chapterType = this._activateRoute.snapshot.queryParams.chapterType;
    this.log(`You are in ${this.chapterType} chapter`);

    // Chapter must be introduction
    // And Geolocation popup should not shown before
    if (this.chapterType === 'introduction' && !this.isGeoLocationCheckDone) {
      this.doGeolocationCheck();
    }

    this.apisService.conversationData$.pipe(
      takeUntil(this.onDestroy$)
    ).subscribe(conversationData => {
      this.log('conversationData intro chat room : ');
      this.log((typeof conversationData) === 'object' ? JSON.stringify(conversationData) : conversationData);
      this.conversationId = conversationData.conversationId;
      // this.streamUrl = conversationData.streamUrl;
      this.initBot();
    });

    /* this.timeoutRef = setTimeout(() => {
      this.openFeedbackPopup();
    }, 10000); */

  }

  ionViewWillLeave() {
    this.botSubRef.unsubscribe();
    this.botSubRef = null;
    this.conversationId = null;
    this.streamUrl = null;
    this.allMessages = [];
    this.allOldMessages = [];
    this.allNewMessages = [];
    this.predictiveTextArr = [];
    this.isBotTyping = false;
    this.enterBtn = '';
    this.selectedMsgCls = '';
    this.talkingToTeddi = false;
    this.isBotInitialized = false;
    this.offset = 0;
    this.limit = 25;
    this.chapterType = '';
    /* clearTimeout(this.timeoutRef); */
  }

  connectToBot(streamUrl) {
    this.isBotInitialized = true;

    this.botSubRef = this.apisService.connectToBot(streamUrl).subscribe(
      res => {
        this.log(`connectToBot data received :: ${JSON.stringify(res)}`);
        if (res.data) {
          const botResp = JSON.parse(res.data);
          this.log(`data resp : ${JSON.stringify(botResp)}` );
          for (const activity of botResp.activities) {
            if (activity.type !== 'typing' && activity.from.id !== this.conversationId) {
              this.isBotTyping = false;
              if (!!this.botTimeoutListener) {
                clearTimeout(this.botTimeoutListener);
              }
            }

            if (
              activity.type === 'message' && !!activity.text &&
              activity.text !== 'end video' &&
              !activity.text.toLowerCase().includes('error') &&
              !activity.text.toLowerCase().includes('read rejected') &&
              !activity.text.toLowerCase().includes('azure')
            ) {
              activity.from.id === this.conversationId ?
              this.processOldSendActivity(activity) :
              this.processIncomingActivity(activity);
            } else if (
              !!activity.text && (
                activity.text.toLowerCase().includes('error') ||
                activity.text.toLowerCase().includes('read rejected') ||
                activity.text.toLowerCase().includes('azure'))
            ) {
              this.botTimeoutPopup();
            }
          }
        }
      }, err => {
        this.log(`BOT Error : ${(typeof err) === 'object' ? JSON.stringify(err) : err}`);
      }, () => {
        this.log('BOT connection is closed');
      }
    );
  }

  async initBot() {
    if(!!this.botSubRef) this.botSubRef.unsubscribe();

    this.allMessages = [];
    this.allOldMessages = [];
    this.allNewMessages = [];

    if (!this.streamUrl) {
      await this.getNewStreamURL();
    }
    this.connectToBot(this.streamUrl);
    this.loadPreviousChat();
  }

  async getNewStreamURL() {
    try {
      const resp = await this.apisService.startConversation(this.conversationId);
      this.streamUrl = resp.streamUrl;
    } catch (error) {
      this.helper.showToast('Something went wrong while connecting to Teddi');
      return;
    }
  }

  async refreshStreamURlAndConnect() {
    this.botSubRef.unsubscribe();
    this.botSubRef = null;
    await this.getNewStreamURL();
    this.connectToBot(this.streamUrl);
  }

  async loadPreviousChat(event = null) {
    const data = {
      conversationId: this.conversationId,
      chapterType: this.chapterType,
      offset: this.offset,
      limit: this.limit
    };
    const oldChats: any = await this.apisService.getChatHistory(data);
    this.infiniteScroll.complete();
    if (oldChats.chatData.length === 0 || oldChats.chatData.length < this.limit) {
      if (event) {
        event.target.disabled = true;
      }
      this.infiniteScroll.disabled = true;
    } else {
      this.offset += this.limit;
    }

    if (this.chapterType !== 'introduction' && this.offset === 0 && oldChats.chatData.length === 0) {
      this.sendBlankMsgForChapter();
    } else {
      this.sendBtnDisabled = false;
      this.isBotTyping = false;
    }

    const tempMsgSplitArr = [];

    oldChats.chatData.slice(0).map(activity => {
      const textArr = activity.text.split('#&@#');

      if (textArr[0] !== 'end video') {
        const otherOptionArr = ['enterBtn', 'predictiveText'];
        let otherOption = null;
        const arr = [];
        textArr.forEach(el => {
          console.log('el : ', el);
          if (!!el && el.includes('selectVideo')) {
            arr.push({ ...activity, text: 'app-videoplayer', original_text: activity.text });
          } else if (!!el && el.includes('selectImage')) {
            const imgUrl = JSON.parse(el).selectImage;
            arr.push({ ...activity, text: 'app-image', imgUrl, original_text: activity.text });
          } else if (!!el && otherOptionArr.some(e => el.includes(e))) {
            otherOption = el;
          } else if (!!el) {
            arr.push({ ...activity, text: this.getParsedMsg(el), original_text: activity.text });
          }
        });
        arr.reverse().map(el => { this.allOldMessages.unshift(el); });
        tempMsgSplitArr.push(otherOption);
      }
    });
    this.mergeOldNewMsg(!event);
    if (this.offset === this.limit || !event) {
      this.checkOptsAndBtnInMsg(tempMsgSplitArr[0]);
    }
  }

  async sendMessage() {
    let msg = this.message;
    if (!msg) { return; }
    msg = msg.trim();
    this.isBotTyping = true;
    this.botTimeoutListener = setTimeout(() => {
      if (this.isBotTyping) {
        this.isBotTyping = false;
        this.botTimeoutPopup();
      }
    }, 30 * 1000);

    const body = {
      type: 'message',
      from: {
        id: this.conversationId
      },
      text: msg,
      timestamp: new Date().toISOString(),
      value: this.conversationId + '|' + msg.replace(/\s/g, "") + '|' + new Date().getTime(),
      chapterType: this.chapterType
    };

    const newActivity: Activity = {
      channelId: 'directline',
      conversation: {id: this.conversationId},
      from: {id: this.conversationId},
      replyToId: '',
      serviceUrl: 'https://directline.botframework.com/',
      text: msg,
      timestamp: new Date().toISOString(),
      type: 'message',
      id: body.value,
    };
    this.allNewMessages.push(newActivity);
    this.mergeOldNewMsg();

    this.message = '';
    this.predictiveTextArr = [];
    try {
      this.log(`SENDING MESSAGE by ${this.conversationId}`);
      this.log(`MESSAGE BODY :: ${JSON.stringify(body)}`);
      const resp: any = await this.apisService.sendMsg(this.conversationId, body);
      this.log((typeof resp) === 'object' ? JSON.stringify(resp) : resp);
    } catch (error) {
      this.log((typeof error) === 'object' ? JSON.stringify(error) : error);
    }
  }

  processIncomingActivity(activity) {
    if (!!activity.value) {
      const jsonParam = JSON.parse(activity.value);
      if (this.isChapterChanged(jsonParam)) {
        setTimeout(() => {
          this.resetChat(jsonParam.chapterName);
          this.loadPreviousChat();
        }, 1000);
        return;
      }
    }

    const textArr = activity.text.split('#&@#');
    const otherOptionArr = ['enterBtn', 'predictiveText'];
    let otherOption = null;
    const arr = [];
    textArr.map(el => {
      if (!!el && el.includes('selectVideo')) {
        arr.push({ ...activity, text: 'app-videoplayer', original_text: activity.text });
      } else if (!!el && el.includes('selectImage')) {
        const imgUrl = JSON.parse(el).selectImage;
        arr.push({ ...activity, text: 'app-image', imgUrl, original_text: activity.text });
      } else if (!!el && otherOptionArr.some(e => el.includes(e))) {
        otherOption = el;
      } else if (!!el) {
        arr.push({ ...activity, text: this.getParsedMsg(el), original_text: activity.text });
      }
    });
    arr.map(el => { this.allNewMessages.push(el); });

    this.allNewMessages.sort((a, b) => moment(a.timestamp).diff(b.timestamp));
    this.mergeOldNewMsg();

    this.checkOptsAndBtnInMsg(otherOption);
    this.sendBtnDisabled = false;
    this.isBotTyping = false;
  }

  getParsedMsg(msg: string) {
    msg = this.helper.replaceNewLineToBr(msg);
    let i = 1;
    while (msg.includes('**')) {
        msg = i % 2 !== 0 ? msg.replace("**", "<strong>") : msg.replace("**", "</strong>");
        i += 1;
    }
    return msg;
  }

  isChapterChanged(param) {
    if (param.hasOwnProperty('chapterName')) {
      return param.chapterName !== this.chapterType;
    }
    return false;
  }

  resetChat(chapterType = '') {
    this.message = '';
    this.allMessages = [];
    this.allOldMessages = [];
    this.allNewMessages = [];
    this.predictiveTextArr = [];
    this.isBotTyping = false;
    this.enterBtn = '';
    this.selectedMsgCls = '';
    this.talkingToTeddi = false;
    this.isBotInitialized = false;
    this.offset = 0;
    this.limit = 25;
    this.chapterType = chapterType;
    this.showScrollBottomBtn = false;
    this.pixelScrollTop = 0;
    this.pixelScrollBottom = 0;
    this.tempPixelField = 0;
    this.sendBtnDisabled = false;
  }

  processOldSendActivity(activity) {
    const length = this.allNewMessages.length - 1;
    for (let i = length; i >= 0; i--) {
      const el = this.allNewMessages[i];
      if (el.id === activity.value) {
        delete activity.value;
        this.allNewMessages[i] = {...activity};
        break;
      }
    }
    this.mergeOldNewMsg();
  }

  mergeOldNewMsg(canScroll = true) {
    this.allMessages = [...this.allOldMessages, ...this.allNewMessages];
    if(canScroll) {
      setTimeout(() => { this.content.scrollToBottom(500); }, 200);
    }
  }

  checkOptsAndBtnInMsg(msg) {
    console.log(msg);
    this.enterBtn = '';
    this.predictiveTextArr = [];
    if (msg) {
      const obj = JSON.parse(msg);
      // const obj = msg;
      if (msg.includes('enterBtn')) {
        this.enterBtn = obj.enterBtn;
      }
      if (msg.includes('predictiveText')) {
        this.predictiveTextArr = obj.predictiveText;
      }
    }
  }

  goTo(url) {
    this.router.navigate([url]);
  }

  async teddiTalk(message, msgIndex) {
    const text = this.helper.stripeEmojis(message.original_text);
    if (!text) { return; }
    this.selectedMsgCls = 'message_' + msgIndex;
    this.tts.speak(text).then(res => {
      this.selectedMsgCls = '';
    }).catch(err => {
      this.selectedMsgCls = '';
      this.helper.showToast('Something went wrong');
    });
  }

  async teddiTalkStop() {
    this.selectedMsgCls = '';
    try {
      await this.tts.stop();
    } catch (error) {
    }
  }

  msgTime(timestamp) {
    return timestamp ? moment(timestamp).format('DD MMM-YYYY, HH:mm A') : '';
  }

  async talk2Teddi() {
    if (this.isBotTyping || this.sendBtnDisabled) { return; }
    try {
      const isAvailable = await this.speechRecognition.isRecognitionAvailable();
      if (isAvailable) {
        const hasPerm = await this.speechRecognition.hasPermission();
        if (!hasPerm) {
          await this.speechRecognition.requestPermission();
          return;
        }

        const optsAnd: SpeechRecognitionListeningOptionsAndroid = {showPopup: false};
        const optsiOS: SpeechRecognitionListeningOptionsIOS = {};

        this.talkingToTeddi = true;
        this.speechRecognition.startListening(this.plt.is('android') ? optsAnd : optsiOS)
        .subscribe(
          (matches: string[]) => {
            this._ngZone.run(() => {
              this.talkingToTeddi = false;
              if (matches.length > 0) {
                this.message = matches[0];
              } else {
                this.helper.showToast('No voice has been detected. Please try again');
              }
            });
          },
          (onerror) => {
            this._ngZone.run(() => { this.talkingToTeddi = false; });
            console.log('startListening error:', onerror);
            this.helper.showToast('No voice has been detected. Please try again');
          }
        );
      }
    } catch (error) {
      console.log('talk2Teddi error : ', error);
      this.helper.showToast('Something went wrong');
    }


  }

  async talk2TeddiStop() {
    if (this.plt.is('ios')) {
      try {
        await this.speechRecognition.stopListening();
      } catch (error) {
        // console.log('talk2TeddiStop error : ', error);
      }
    }
  }

  logScrolling(event?) {
    if (event) {
      if (event.detail.deltaY < 0 && this.pixelScrollTop >= 0) {
        this.tempPixelField = event.detail.deltaY;
      }
      if (event.detail.deltaY > 0 && !!this.pixelScrollTop) {
        this.tempPixelField = event.detail.deltaY;
      }
    }
    this.teddiTalkStop();
    this.talk2TeddiStop();
  }

  async openFeedbackPopup() {
    const modal = await this.modalCtrl.create({
      component: FeedbackModalPage,
      cssClass: 'feedback-modal-popup',
      swipeToClose: true,
      componentProps: { chapterType: this.chapterType }
    });
    return await modal.present();
  }
  async letsGo() {
    await this.storage.set(STATICNAME.isIntroComplete, true);
    this.goTo('chapter-list');
  }

  async sendBlankMsgForChapter(msg = '') {
    try {
      this.sendBtnDisabled = true;
      this.isBotTyping = true;
      const body = {
        type: 'message',
        from: {
          id: this.conversationId
        },
        text: msg,
        timestamp: new Date().toISOString(),
        value: this.conversationId + '|' + ''.replace(/\s/g, "") + '|' + new Date().getTime(),
        chapterType: this.chapterType
      };
      const resp: any = await this.apisService.sendMsg(this.conversationId, body);
      // this.sendBtnDisabled = false;
    } catch (error) {
      console.log(error);
      this.sendBtnDisabled = false;
      this.isBotTyping = false;
    }
  }

  async playVideo(allVideos: VideoFormat[]) {
    const modal = await this.modalCtrl.create({
      component: VideoPlayerPage,
      componentProps: { allVideos }
    });
    modal.onDidDismiss().then(res => {
      /**
       * We are disabling this code as Kesh told so
       */
      // this.sendBlankMsgForChapter('end video');
    });
    await modal.present();
  }

  onMsgClick(message, evt) {
    console.log(message);
    const el = evt.target;
    if (el.localName === 'a') {
      const url = el.innerHTML;
      this.helper.openBrowser(url);
    } else if (message.original_text.includes('selectVideo')) {
      const textArr = message.original_text.split('#&@#');
      let obj;
      textArr.map(el => {
        if (el.includes('selectVideo')) { obj = JSON.parse(textArr[1]); }
      });
      if (!!obj) {
        const allVideos = obj.selectVideo.map(el => {
          const keys = Object.keys(el);
          return { name: keys[0], url: el[keys[0]] } as VideoFormat;
        });
        this.playVideo(allVideos);
      }
    } else if (message.original_text.includes('selectImage')) {
      console.log('////////// 1');
      const imgUrl = message.imgUrl;
      console.log('////////// 2');
      this.helper.viewPhoto(imgUrl);
    }
  }

  onScrollEnd($event) {
    if (this.tempPixelField < 0) {
      this.pixelScrollTop = this.pixelScrollTop + Math.abs(this.tempPixelField);
    } else {
      this.pixelScrollBottom = this.tempPixelField;
    }
    this.tempPixelField = 0;

    if (!!this.pixelScrollTop && !!this.pixelScrollBottom) {
      this.pixelScrollTop = this.pixelScrollTop - this.pixelScrollBottom;
      this.pixelScrollBottom = 0;
    }

    if (this.pixelScrollTop > 16) {
      this.showScrollBottomBtn = true;
    } else {
      this.scrollToBottom();
    }
  }

  scrollToBottom() {
    this.showScrollBottomBtn = false;
    this.pixelScrollTop = 0;
    this.pixelScrollBottom = 0;
    this.tempPixelField = 0;
    this.content.scrollToBottom(200);
  }


  /**
   * METHOD: botTimeoutPopup
   * PURPOSE: It will shows an Alert Popup when BOT Timedout or does not receive any response for 2 mins
   */
  async botTimeoutPopup() {
    let msg = '';
    const btn = [];

    if (this.chapterType !== 'introduction') {
      msg = 'Teddi has gone for a quick cuppa ☕️ Please go back to the chapter screen and then come back here to continue!';
      btn.push({
        text: 'OK',
        handler: () => {
            this.router.navigate(['chapter-list']);
        }
      });
    } else {
      msg = 'Teddi has gone for a quick cuppa ☕️';
      btn.push({
        text: 'Try again',
        handler: () => {
          this.resetChat(this.chapterType);
          this.initBot();
        }
      });
    }

    const alert = await this.alertCtrl.create({
      cssClass: 'bot-timeout-popup',
      message: msg,
      backdropDismiss: false,
      buttons: btn
    });
    await alert.present();
  }

  getParsedNote(msg: string) {
    const patt = /(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gim;
    // const parsedHtml = msg.replace(patt, "<a onclick=\"localStorage.setItem('linkToOpen','$1');\">$1</a>");
    const parsedHtml = msg.replace(patt, "<a>$1</a>");
    return this.sanitizer.bypassSecurityTrustHtml(parsedHtml);
  }

  async doGeolocationCheck() {

    // We need to do this as the method is invoked in ionViewWillEnter.
    this.isGeoLocationCheckDone = true;

    try {
      const geolocationRes = await this.geolocation.getCurrentPosition({ enableHighAccuracy: true });

      const options: NativeGeocoderOptions = { useLocale: true, maxResults: 5 };
      const geocodeRes = await this.nativeGeocoder.reverseGeocode(geolocationRes.coords.latitude, geolocationRes.coords.longitude, options);
      // const geocodeRes = await this.nativeGeocoder.reverseGeocode(51.4761054, 0.3200848, options);

      const postalCodeObj = geocodeRes.find(e => !!e.postalCode);

      const apiRes: any = await this.apisService.getSinglePostcodeDetail(postalCodeObj.postalCode);

      if (apiRes.postcodeData.location === "Thurrock") {
        const modal = await this.modalCtrl.create({
          component: LocationMessagePage,
          cssClass: 'location-modal-popup',
          swipeToClose: true
        });
        return await modal.present();
      }

    } catch (error) {
      console.log('Error on postalcode checking', error);
      // error instanceof HttpErrorResponse
    }
  }

  log(message) {
    // TestFairy.log(`>>>>>>>>>>> ${message}`);
    console.log(`>>>>>>>>>>> ${message}`);
  }

}
