'use strict';

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

let request = require('supertest');
let expect = require('chai').expect;
let app = require("../../services/api.js").createApp(
	{ session: require('express-session')({ secret: 'testing'}) }
);
let log_iface = require("../../logger.js");
let systemLogger = log_iface.systemLogger;
let responseCodes = require("../../response_codes.js");

describe('Upload a project', function () {
	let User = require('../../models/user');
	let server;
	let agent;
	let username = 'upload_username';
	let password = 'password';
	let email = 'test3drepo@mailinator.com';
	let project = 'project1';

	let desc = 'desc';
	let type = 'type';

	before(function(done){

		server = app.listen(8080, function () {
			console.log('API test server is listening on port 8080!');

			//hack: by starting the server earlier all the mongoose models like User will be connected to db without any configuration
			request(server).get('/info').end(() => {

				agent = request.agent(server);

				// create a user
				return User.createUser(systemLogger, username, password, {
					email: email
				}, 200000).then(emailVerifyToken => {
					return User.verify(username, emailVerifyToken.token, true);
				}).then(user => {
					
					//login
					agent.post('/login')
					.send({ username, password })
					.expect(200, function(err, res){
						expect(res.body.username).to.equal(username);
						
						if(err){
							return done(err);
						}

						//create a project
						agent.post(`/${username}/${project}`)
						.send({ type, desc })
						.expect(200, function(err, res){
							done(err);
						});

					});

				}).catch(err => {
					done(err);
				});

			});
			
		});

	});

	after(function(done){
		server.close(function(){
			console.log('API test server is closed');
			done();
		});
	});

	describe('without quota', function(){

		it('should return error', function(done){
			agent.post(`/${username}/${project}/upload`)
			.attach('file', __dirname + '/../../statics/3dmodels/toy.ifc')
			.expect(400, function(err, res){
				expect(res.body.value).to.equal(responseCodes.SIZE_LIMIT_PAY.value);
				done(err);
			});
		});

	});

	describe('with quota', function(){

		before(function(){
			//give some money to this guy
			return User.findByUserName(username).then( user => {
				return user.createSubscriptionToken('THE-100-QUID-PLAN', user.user)
			}).then(subscription => {
				return User.activateSubscription(subscription.token, {}, {}, true);
			})
		});

		it('should success', function(done){
			agent.post(`/${username}/${project}/upload`)
			.attach('file', __dirname + '/../../statics/3dmodels/toy.ifc')
			.expect(200, function(err, res){

				let q = require('../../services/queue');
				 q.channel.assertQueue(q.workerQName, { durable: true }).then( info => {

				 	// upload api return before insert item to queue
					setTimeout(function(){
						//expect 1 message in the worker queue
						expect(info.messageCount).to.equal(1);
						done(err);
					}, 1000);


				 }).catch(err => {
				 	done(err);
				 });

				
			});
		});

		it('', function(){

		});

	});
});