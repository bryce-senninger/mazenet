/* Mazenet - Fresh4Less - Samuel Davidson | Elliot Hatch */
/// <reference path="../../../../../typings/tsd.d.ts" />

import NewRoomDirective = require('./NewRoomMenuDirective');

export = angular.module('mod.controlmenu.newelementmenu.newroommenu', [])
    .directive('mzNewRoomMenu', NewRoomDirective)