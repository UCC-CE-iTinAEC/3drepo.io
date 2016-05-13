/**
 *  Copyright (C) 2014 3D Repo Ltd
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU Affero General Public License for more details.
 *
 *  You should have received a copy of the GNU Affero General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

var express = require('express');
var router = express.Router({mergeParams: true});
var config = require("../config.js");
// var _ = require('lodash');
var utils = require('../utils');
var middlewares = require('./middlewares');
var ProjectSetting = require('../models/projectSetting');
var responseCodes = require('../response_codes');
var C               = require("../constants");
var Role = require('../models/role');
var User = require('../models/user');
var importQueue = require('../services/queue');
var multer = require("multer");

var getDbColOptions = function(req){
	return {account: req.params.account, project: req.params.project};
};

// bid4free exclusive api get project info
router.get('/:project/info.json', hasReadProjectInfoAccess, B4F_getProjectSetting);
//  bid4free exclusive api update project info
router.post('/:project/info.json', middlewares.isMainContractor, B4F_updateProjectSetting);

// Get project info
router.get('/:project.json', middlewares.hasReadAccessToProject, getProjectSetting);

router.put('/:project/settings/map-tile', middlewares.hasWriteAccessToProject, updateMapTileSettings);

router.post('/:project', middlewares.canCreateProject, createProject);

router.post('/:project/upload', middlewares.canCreateProject, uploadProject);

function updateMapTileSettings(req, res, next){
	'use strict';


	let place = utils.APIInfo(req);
	let dbCol =  {account: req.params.account, project: req.params.project, logger: req[C.REQ_REPO].logger};

	return ProjectSetting.findById(dbCol, req.params.project).then(projectSetting => {
		return projectSetting.updateMapTileCoors(req.body);
	}).then(projectSetting => {
		responseCodes.respond(place, req, res, next, responseCodes.OK, projectSetting);
	}).catch(err => {
		responseCodes.respond(place, req, res, next, err.resCode || utils.mongoErrorToResCode(err), err.resCode ? {} : err);
	});
}


function _getProject(req){
	'use strict';

	return ProjectSetting.findById(getDbColOptions(req), req.params.project).then(setting => {
		if(!setting){
			return Promise.reject({ resCode: responseCodes.PROJECT_INFO_NOT_FOUND});
		} else {
			return Promise.resolve(setting);
		}
	});
}

function B4F_getProjectSetting(req, res, next){
	'use strict';

	let place = '/:account/:project/info.json GET';
	_getProject(req).then(setting => {
		responseCodes.respond(place, req, res, next, responseCodes.OK, setting.info);
	}).catch(err => {
		responseCodes.respond(place, req, res, next, err.resCode || utils.mongoErrorToResCode(err), err.resCode ? {} : err);
	});
}

function B4F_updateProjectSetting(req, res, next){
	'use strict';

	let place = '/:account/:project/info.json POST';

	ProjectSetting.findById(getDbColOptions(req), req.params.project).then(setting => {

		if(!setting){
			setting = ProjectSetting.createInstance(getDbColOptions(req));
			setting._id = req.params.project;
		}
		return Promise.resolve(setting);

	}).then(setting => {

		let whitelist = [
			'name',
			'site',
			'code',
			'client',
			'budget',
			'completedBy',
			'contact'
		];

		setting.info = setting.info || {};
		setting.info = utils.writeCleanedBodyToModel(whitelist, req.body, setting.info);
		return setting.save();

	}).then(setting => {
		responseCodes.respond(place, req, res, next, responseCodes.OK, setting.info);
	}).catch(err => {
		responseCodes.respond(place, req, res, next, err.resCode || utils.mongoErrorToResCode(err), err.resCode ? {} : err);
	});
}

function hasReadProjectInfoAccess(req, res, next){

	middlewares.checkRole([/*C.REPO_ROLE_SUBCONTRACTOR, */C.REPO_ROLE_MAINCONTRACTOR], req).then((/*roles*/) => {
		// if role is maincontractor then no more check is needed
		return Promise.resolve();
	}).catch(() => {
		return middlewares.isSubContractorInvitedHelper(req);
	}).then(() => {
		next();
	}).catch(resCode => {
		responseCodes.respond("Middleware: check has read access", req, res, next, resCode, null, req.params);
	});
}

function getProjectSetting(req, res, next){
	'use strict';

	let place = utils.APIInfo(req);
	_getProject(req).then(setting => {

		let whitelist = ['owner', 'desc', 'type', 'permissions', 'properties', 'status'];
		let resObj = {};
		
		whitelist.forEach(key => {
			resObj[key] = setting[key];
		});

		responseCodes.respond(place, req, res, next, responseCodes.OK, resObj);
		
	}).catch(err => {
		responseCodes.respond(place, req, res, next, err.resCode || utils.mongoErrorToResCode(err), err.resCode ? {} : err);
	});
}

function _createAndAssignRole(project, account, username, desc, type) {
	'use strict';

	let roleId = `${account}.${project}`;

	return Role.findByRoleID(roleId).then(role =>{
		
		if(role){
			return Promise.resolve();
		} else {
			return Role.createRole(account, project);
		}

	}).then(() => {

		return User.grantRoleToUser(username, account, project);

	}).then(() => {

		return ProjectSetting.findById({account, project}, project).then(setting => {

			if(setting){
				return Promise.reject({resCode: responseCodes.PROJECT_EXIST});
			}

			setting = ProjectSetting.createInstance({
				account: account, 
				project: project
			});
			
			setting._id = project;
			setting.owner = username;
			setting.desc = desc;
			setting.type = type;
			
			return setting.save();
		});

	});
}

function createProject(req, res, next){
	'use strict';
	
	let responsePlace = utils.APIInfo(req);
	let project = req.params.project;
	let account = req.params.account;
	let username = req.session.user.username;

	_createAndAssignRole(project, account, username, req.body.desc, req.body.type).then(() => {
		responseCodes.respond(responsePlace, req, res, next, responseCodes.OK, { account, project });
	}).catch( err => {
		responseCodes.respond(responsePlace, req, res, next, err.resCode || utils.mongoErrorToResCode(err), err.resCode ? {} : err);
	});
}

/*******************************************************************************
 * Converts error code from repobouncerclient to a response error object
 * @param {errCode} - error code referenced in error_codes.h
 *******************************************************************************/
function convertToErrorCode(errCode){

    var errObj;

    switch (errCode) {
        case 0:
            errObj = responseCodes.OK;
            break;
        case 1:
            errObj = responseCodes.FILE_IMPORT_INVALID_ARGS;
            break;
        case 2:
            errObj = responseCodes.NOT_AUTHORIZED;
            break;
        case 3:
            errObj = responseCodes.FILE_IMPORT_UNKNOWN_CMD;
            break;
        case 5:
            errObj = responseCodes.FILE_IMPORT_PROCESS_ERR;
            break;
        default:
            errObj = responseCodes.FILE_IMPORT_UNKNOWN_ERR;
            break;

    }
    return errObj;
}

function uploadProject(req, res, next){
	'use strict';

	let responsePlace = utils.APIInfo(req);
	if (config.cn_queue) {

		var upload = multer({ dest: config.cn_queue.upload_dir });
		upload.single("file")(req, res, function (err) {
			if (err) {
				return responseCodes.respond(responsePlace, req, res, next, responseCodes.FILE_IMPORT_PROCESS_ERR, {});
			} else {

				let projectSetting;

				let project = req.params.project;
				let account = req.params.account;
				let username = req.session.user.username;

				_createAndAssignRole(project, account, username, req.body.desc, req.body.type).then(setting => {
					//console.log('setting', setting);
					return Promise.resolve(setting);
				}).catch(err => {

					if (err && err.resCode && err.resCode.value === responseCodes.PROJECT_EXIST.value){
						return _getProject(req);
					} else {
						return Promise.reject(err);
					}
				}).then(setting => {

					projectSetting = setting;
					projectSetting.status = 'processing';
					return projectSetting.save();

				}).then(() => {

					// api respond once the file is uploaded

					responseCodes.respond(responsePlace, req, res, next, responseCodes.OK, { status: 'uploaded'});

					return importQueue.importFile(
						req.file.path, 
						req.file.originalname, 
						req.params.account,
						req.params.project,
						req.session.user.username
					)
					.then(corID => Promise.resolve(corID))
					.catch(errCode => {
						//catch here to provide custom error message
						return Promise.reject(convertToErrorCode(errCode));
					});

				}).then(corID => {

					req[C.REQ_REPO].logger.logInfo(`Job ${corID} imported without error`);

					//mark project ready
					projectSetting.status = 'ok';
					return projectSetting.save();

				}).catch(err => {
					// import failed for some reason(s)...
					console.log(err);
					//mark project ready
					projectSetting && (projectSetting.status = 'failed');
					projectSetting && projectSetting.save();

					req[C.REQ_REPO].logger.logDebug(JSON.stringify(err));

		

				});
				

			}
		});

	} else {
		responseCodes.respond(
			responsePlace, 
			req, res, next, 
			responseCodes.QUEUE_NO_CONFIG, 
			{}
		);
	}
}

module.exports = router;


