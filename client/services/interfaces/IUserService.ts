/* Mazenet - Fresh4Less - Samuel Davidson | Elliot Hatch */
/// <reference path="../../../typings/index.d.ts" />
import UserData = require("./../../models/UserData");
import Cursor = require("./../../models/cursors/Cursor");

export = IUserService;

interface IUserService {
    UserData: UserData;
    OtherUsers:  { [id: string] : UserData; };
    RedrawCallback:()=>void;
    AddUser(user:UserData);
    RemoveUser(user:UserData);
    SetUsers(users:UserData[]);
    GetUserById(id:string):UserData;
    UpdatePosition(cursor:Cursor);
}