/* Mazenet - Fresh4Less - Samuel Davidson | Elliot Hatch */
/// <reference path="../../../../typings/index.d.ts" />

import PermissionSettingsController = require('./PermissionSettingsController');

export = RoomPreviewDirective;

function RoomPreviewDirective():ng.IDirective {
    var directive = <ng.IDirective> {
        restrict: 'E',
        scope: {
            permissions: '=',
        },
        templateUrl: '/modules/controlMenu/permissionSettings/PermissionSettingsTemplate.html',
        controller: PermissionSettingsController,
        controllerAs: 'psCtrl',
        bindToController: true
    };
    return directive;
}