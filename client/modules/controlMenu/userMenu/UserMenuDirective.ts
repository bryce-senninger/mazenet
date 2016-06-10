/* Mazenet - Fresh4Less - Samuel Davidson | Elliot Hatch */
/// <reference path="../../../../typings/index.d.ts" />

import UserMenuController = require("./UserMenuController");

export = UserMenuDirective;

function UserMenuDirective():ng.IDirective {
    var directive = <ng.IDirective> {
        restrict: 'E',
        templateUrl: '/modules/controlMenu/userMenu/UserMenuTemplate.html',
        controller: UserMenuController,
        controllerAs: 'uCtrl',
        bindToController: true
    };
    return directive;
}