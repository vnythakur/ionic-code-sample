import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams, HttpRequest } from '@angular/common/http';

import { environment } from '../../../environments/environment';
import * as CONST from '../../constants';
import { Conversation, LoggedinUser } from 'src/app/models/directline.model';

import {webSocket, WebSocketSubject} from 'rxjs/webSocket';
import { HTTP } from '@ionic-native/http/ngx';
import { BehaviorSubject } from 'rxjs';

// declare var TestFairy: any;

@Injectable({
  providedIn: 'root'
})
export class ApisService {

  public conversationData$ = new BehaviorSubject<Conversation>(null);
  public userData$ = new BehaviorSubject<LoggedinUser>(null);

  constructor(
    private http: HttpClient,
    private advHttp: HTTP
  ) { }

  /**
   * GET A QUOTE
   */
  getAllQuotes() {
    const url = `${environment.BASEURL}${CONST.ALL_QUOTES}`;
    return this.http.get(url).toPromise();
  }

  /**
   * ADD NEW USER
   */
  addNewUser(conversationId: string) {
    const url = `${environment.BASEURL}${CONST.ADD_NEW_USER}`;
    return this.http.post(url, {conversationId}).toPromise();
  }

  /**
   * GET CHAT HISTORY FROM OUR DB
   */
  getChatHistory(data: {conversationId, chapterType, offset, limit}) {
    const url = `${environment.BASEURL}${CONST.CHAT_HISTORY}`;
    return this.http.post(url, data).toPromise();
  }

  /**
   * GET POSTCODE DETAIL AND LOCATION NAME
   * @param postcode POST CODE OF USER'S CURRENT LOCATION
   */
  getSinglePostcodeDetail(postcode) {
    const url = `${environment.BASEURL}${CONST.POSTCODE_DETAIL}?postcode=${postcode}`;
    return this.http.get(url).toPromise();
  }

  /**
   * ADD FEEDBACK - CHAPTER WISE OR APP LEVEL
   * @param body ACCEPT OBJECT CONTAINING BELOW DATA
   *  conversationId - Conversation id of the user
   *  feedbackMsg - Message of the feedback
   *  isSmiled - (Optional) Only passed for Chapter level feedback. Holds value for the smiley "happy" | "sad"
   *  chapterType - (Optional) Only passed for Chapter level feedback. Holds name of the chapter
   */
  addFeedback(body: { conversationId: string; feedbackMsg: string; isSmiled?: string; chapterType?: string; }) {
    const url = `${environment.BASEURL}${CONST.ADD_FEEDBACK}`;
    return this.http.post(url, body).toPromise();
  }

  /**
   * GET ALL CATEGORY LIST OF RECIPES
   */
  getCategoryList() {
    const url = `${environment.BASEURL}${CONST.ALL_RECIPE_CATEGORY}`;
    return this.http.get(url).toPromise();
  }

  /**
   * GET ALL RECIPES LIST BY CATEGORY
   */
  getRecipesList(categoryName: string) {
    const url = `${environment.BASEURL}${CONST.RECIPES_BY_CATEGORY}?categoryName=${categoryName}`;
    return this.http.get(url).toPromise();
  }

  /**
   * GET ALL RECIPES LIST BY CATEGORY
   */
  getRecipeDetail(recipeId: string) {
    const url = `${environment.BASEURL}${CONST.RECIPE_DETAIL}?recipeId=${recipeId}`;
    return this.http.get(url).toPromise();
  }


  /**
   * DIRECTLINE APIS
   */

  connectToBot(address: string) {
    const myWebSocket: WebSocketSubject<any> = webSocket({
      url: address,
      deserializer: msg => msg
    });
    // TestFairy.log(`>>>>>>>>>>> CONNECTING TO SOCKET`);
    console.log(`>>>>>>>>>>> CONNECTING TO SOCKET`);
    return myWebSocket.asObservable();
  }

  startConversation(conversationId = '') {
    const url = `${environment.DIRECTLINE}${CONST.START_CONV}/${conversationId}`;
    const httpOptions = {
        headers: new HttpHeaders({
            Authorization: `Bearer ${environment.DIRECTLINE_TOKEN}`
        })
    };
    if (conversationId) {
      return this.http.get<Conversation>(url, httpOptions).toPromise();
    } else {
      return this.http.post<Conversation>(url, {}, httpOptions).toPromise();
    }
  }

  getOldActivities(conversationId, watermark = '') {
    let path = CONST.GET_ACTIVITIES.replace('{conversationId}', conversationId);
    path = path + (watermark ? '?watermark=' + watermark : '');
    const url = `${environment.DIRECTLINE}${path}`;

    const httpOptions = {
        headers: new HttpHeaders({
            Authorization: `Bearer ${environment.DIRECTLINE_TOKEN}`
        })
    };
    return this.http.get(url, httpOptions).toPromise();
  }

  sendMsg(conversationId, body) {
    //  {"type": "message","from": {"id": "**fromUserId**"},"text": "**Message**"}
    const path = CONST.SEND_ACTIVITY.replace('{conversationId}', conversationId);
    const url = `${environment.DIRECTLINE}${path}`;
    const httpOptions = {
        headers: new HttpHeaders({
            Authorization: `Bearer ${environment.DIRECTLINE_TOKEN}`
        })
    };
    return this.http.post(url, body, httpOptions).toPromise();
  }

  registerUser(data) {
    const url = `${environment.BASEURL}${CONST.REGISTER_USER}`;
    return this.http.put(url, data).toPromise();
  }

  loginUser(data: {email: string, password: string}) {
    const url = `${environment.BASEURL}${CONST.LOGIN_USER}`;
    return this.http.post(url, data).toPromise();
  }

  downloadFile(fileURL: string, filePath: string) {
    // const req = new HttpRequest(method: 'GET', )
    return this.advHttp.downloadFile(fileURL, {}, {}, filePath);
  }

  forgotPassword(email: string) {
    const url = `${environment.BASEURL}${CONST.FORGOT_PASS}`;
    return this.http.post(url, {email}).toPromise();
  }

  editUser(data) {
    const url = `${environment.BASEURL}${CONST.EDIT_USER}`;
    return this.http.put(url, data).toPromise();
  }

  getFaqByChapter(chapterName) {
    const url = `${environment.BASEURL}${CONST.FAQ_BY_CHAPTER}?chapterName=${chapterName}`;
    return this.http.get(url).toPromise();
  }
  
}
