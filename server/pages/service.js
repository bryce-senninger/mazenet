var BPromise = require('bluebird');
var ObjectID = require('mongodb').ObjectID;
var CustomErrors = require('../util/custom-errors');

var pagesDataAccess = require('./dataAccess');
var Validator = require('fresh-validation').Validator;

// initialze validator
var validator = new Validator();

//pages schema
// field names in parentheses () optional
//  creator: String (userId)
//  owner: Array String (userId)
//  permissions: String ('none', 'links', 'all')
//  title: String,
//  (whitelist): Array (userId)
//  background: object { type: String, data: {...} },
//  elements: Array (see /elements/service)
//  cursors: Array { uId: String, frames: Array { pos: { x: int, y: int }, t: int } }

var permissionsValues = ['none', 'links', 'all'];
var backgroundTypes = ['color'];

function getPage(pageIdStr) {
	return BPromise.try(function() {
		validator.is(pageIdStr, 'pageId').required().objectId();
		validator.throwErrors();
		return pagesDataAccess.getPage(validator.transformationOutput());
	})
	.then(function(page) {
		return page;
	});
}

function createPage(pageParams) {
	return BPromise.try(function() {
		validator.is(pageParams, 'pageParams').required().object()
			.property('creator').required().objectId().back()
			.property('permissions').required().elementOf(permissionsValues).back()
			.property('title').required().string().back()
			.property('background').required().object()
			.property('type').elementOf(backgroundTypes).back();
		validator.throwErrors();
		validator.whitelist({ creator: true, background: { data: true } });
		var sanitizedPageParams = validator.transformationOutput();
		sanitizedPageParams.owners = [sanitizedPageParams.creator];
		return pagesDataAccess.createPage(sanitizedPageParams);
	})
	.then(function(page) {
		return page;
	});
}

function createCursor(pageIdStr, cursorParams) {
	return BPromise.try(function() {
		validator.is(pageIdStr, 'pageId').required().objectId();
		var pageId = validator.transformationOutput();
		validator.is(cursorParams, 'cursorParams').required().object()
			.property('uId').required().objectId().back()
			.property('frames').required().array();//.foreach()
		validator.throwErrors();
		validator.whitelist();
		return pagesDataAccess.createCursor(pageId, validator.transformationOutput());
	});
}

module.exports = {
	getPage: getPage,
	createPage: createPage,
	createCursor: createCursor
};
