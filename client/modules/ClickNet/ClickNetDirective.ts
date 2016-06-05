/* Mazenet - Fresh4Less - Samuel Davidson | Elliot Hatch */
/// <reference path="../../../typings/tsd.d.ts" />

import ClickNetController = require("./ClickNetController");

export = ClickNetDirective;

function ClickNetDirective():ng.IDirective {
    var directive = <ng.IDirective>{
        restrict: 'E',
        templateUrl: '/modules/ClickNet/ClickNetTemplate.html',
        controller: ClickNetController,
        controllerAs: 'cnCtrl',
        bindToController: true
    };
    return directive;
}