/* Mazenet - Fresh4Less - Samuel Davidson | Elliot Hatch */
/// <reference path="../../../typings/index.d.ts" />

import CanvasDirective = require('./CanvasDirective');

export = angular.module('mod.canvas', [])
    .directive('mzCanvas', CanvasDirective);