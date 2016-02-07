/* Mazenet - Fresh4Less - Samuel Davidson | Elliot Hatch */
/// <reference path="../../typings/tsd.d.ts" />
import io = require('socketio');

import CursorFrame = require("../models/Cursors/CursorFrame");
import IElement = require('./../models/Interfaces/IElement');
import ISocketService = require("./Interfaces/ISocketService");
import MzPosition = require('./../models/MzPosition');
import Cursor = require('./../models/Cursors/Cursor');
import Page = require('./../models/Pages/Page');
import IUserService = require('./Interfaces/IUserService');
import IActivePageService = require("./Pages/Interfaces/IActivePageService");

export = SocketService;

class SocketService implements ISocketService {
    static name:string = "SocketService";
    private socket:SocketIO.Socket;
    private pageEnterPromise:angular.IDeferred<Page> = null;
    private elementCreatePromise:angular.IDeferred<IElement> = null;

    static FactoryDefinition = [
        '$q',
        '$http',
        '$location',
        'UserService',
        'ActivePageService',
        ($q:angular.IQService,
         $http:angular.IHttpService,
         $location:angular.ILocationService,
         UserService:IUserService,
         ActivePageService:IActivePageService)=>{return new SocketService($q, $http, $location, UserService, ActivePageService)}
    ];
    constructor(private $q:angular.IQService,
                private $http:angular.IHttpService,
                private $location:angular.ILocationService,
                private UserService:IUserService,
                private ActivePageService:IActivePageService){
    }
    public Init() {
        if(!this.socket || !this.socket.connected) {
            this.socket = io('http://'+ this.$location.host() +':' + this.$location.port() + '/mazenet');
            this.socket.on('users/connected', this.connectedCallback());
            this.socket.on('users/connected:failure', this.connectErrorCallback());
            this.socket.on('pages/userEntered', this.userEnteredCallback());
            this.socket.on('pages/userLeft', this.userLeftCallback());
            this.socket.on('pages/cursors/moved', this.userMovedCursorCallback());
            this.socket.on('pages/enter:success', this.userEnterPageCallback());
            this.socket.on('pages/enter:failure', this.userEnterPageFailureCallback());
            this.socket.on('pages/elements/created', this.elementCreatedCallback());
            this.socket.on('pages/element/create:failure', this.elementCreateFailureCallback());
            this.socket.on('pages/updated', this.pageUpdatedCallback());
            this.socket.on('pages/update:failure', this.pageUpdateFailureCallback());
        }
    }
    public EnterPage(pageId:string, pos:MzPosition) {
        this.pageEnterPromise = this.$q.defer();
        var startPage = { //TODO Consider Refactoring
            pId: pageId,
            pos: {
                x: pos.x,
                y: pos.y
            }
        };
        this.socket.emit('pages/enter', startPage);
        return this.pageEnterPromise.promise;
    }

    public UpdatePage(pageData:Page) {
        this.socket.emit('pages/update', pageData);
    }

    public CreateElement(element:IElement) {
        this.elementCreatePromise = this.$q.defer();

        this.socket.emit('pages/elements/create', element);

        return this.elementCreatePromise.promise;
    }

    public CursorMove(cursor:CursorFrame) {
        this.socket.emit('pages/cursors/moved', cursor);
    }

    /* Event Handlers */
    private connectedCallback():(any)=>void {
        var self = this;
        return (user)=> {
            self.UserService.UserData.uId = user.uId;
            self.ActivePageService.RootPages.root = user.rootPageId;
            self.ActivePageService.RootPages.homepage = user.homepageId;
            self.loadInitialPage();
        };
    };
    private connectErrorCallback():(any)=>void {
        return (error) => {
            console.error("Could not connect to the Mazenet.", error);
        };
    };
    private userEnteredCallback():(any)=>void {
        var self = this;
        return (user)=> {
            console.log(user);
            self.UserService.AddUser(user);
        }
    };
    private userLeftCallback():(any)=>void {
        var self = this;
        return (user) => {
            self.UserService.RemoveUser(user);
        }
    };
    private userMovedCursorCallback():(any)=>void {
        var self = this;
        return (cursor) => {
            self.UserService.UpdatePosition(cursor);
        };
    };
    private userEnterPageCallback():(any)=>void {
        var self = this;
        return (pageData) => {
            self.$location.path('room/'+pageData.page._id);
            self.ActivePageService.LoadPage(pageData.page);
            self.UserService.SetUsers(pageData.users);
            self.pageEnterPromise.resolve(pageData);
        };
    };
    private userEnterPageFailureCallback():(any)=>void {
        var self = this;
        return (error)=>{
            self.pageEnterPromise.reject(error);
        };
    };
    private elementCreatedCallback():(any)=>void {
        var self = this;
        return (element) => {
            self.ActivePageService.AddElement(element);
            self.elementCreatePromise.resolve(element);
        };
    };
    private elementCreateFailureCallback():(any)=>void {
        var self = this;
        return (error) => {
            self.elementCreatePromise.reject(error);
        };
    };
    private pageUpdatedCallback():(any)=>void {
        var self = this;
        return (pageChanges) => {
            this.ActivePageService.UpdatePage(pageChanges);
        };
    };
    private pageUpdateFailureCallback():(any)=>void {
        var self = this;
        return (error) => {
            console.error('Error updating page.', error);
        };
    };
    private loadInitialPage() {
        var self = this;
        var successCallback = function(page) {
            console.log('Welcome to Mazenet.', self.UserService.UserData);
        };
        var failureCallback = function(error) {
            console.error('Could not enter page... redirecting to root.');
            self.EnterPage(error.rootPageId, {x: 0, y: 0}).then(successCallback, function(error) {
                console.error('Error loading root page. The Mazenet is dead.');
            });
        };
        if(self.ActivePageService.RootPages.url) {
            self.EnterPage(self.ActivePageService.RootPages.url, {x: 0, y: 0}).then(successCallback, failureCallback);
        } else if(self.ActivePageService.RootPages.homepage) {
            self.EnterPage(self.ActivePageService.RootPages.homepage, {x: 0, y: 0}).then(successCallback, failureCallback);
        } else if(self.ActivePageService.RootPages.root) {
            self.EnterPage(self.ActivePageService.RootPages.root, {x: 0, y: 0}).then(successCallback, failureCallback);
        } else {
            console.error('No root page, homepage, or url page defined.');
        }
    }
}