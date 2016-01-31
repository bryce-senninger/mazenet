/* Mazenet - Fresh4Less - Samuel Davidson | Elliot Hatch */
/// <reference path="../../typings/tsd.d.ts" />
import UserData = require("./../models/UserData");
import Cursor = require("./../models/Cursor");
import IUserService = require('./Interfaces/IUserService');

export = UserService

class UserService implements IUserService {
    static name:string = "UserService";
    public UserData: UserData;
    public OtherUsers: { [id: string] : UserData; };
    public RedrawCallback:()=>{};

    $inject = [];

    constructor() {
        this.UserData = new UserData;
        this.OtherUsers = {};
    }
    public AddUser(user:UserData) {
        this.OtherUsers[user.uId] = user;
        this.redraw();
    };
    public RemoveUser(user:UserData){
        delete this.OtherUsers[user.uId];
        this.redraw();
    };
    public SetUsers(users:UserData[]){
        this.OtherUsers = {};
        users.forEach(function(user) {
            this.serviceObject.OtherUsers[user.uId] = user;
        }, this);
        this.redraw();
    };
    public GetUserById(id:string):UserData {
        return this.OtherUsers[id];
    };
    public UpdatePosition(cursor:Cursor) {
        if(this.OtherUsers[cursor.uId]){
            this.OtherUsers[cursor.uId].pos.x = cursor.pos.x;
            this.OtherUsers[cursor.uId].pos.y = cursor.pos.y;
        }
        this.redraw();
    };


    private redraw = function() {
    if(this.RedrawCallback) {
        this.RedrawCallback();
    }
};
}