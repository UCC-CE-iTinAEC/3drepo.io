/**
 **  Copyright (C) 2014 3D Repo Ltd
 **
 **  This program is free software: you can redistribute it and/or modify
 **  it under the terms of the GNU Affero General Public License as
 **  published by the Free Software Foundation, either version 3 of the
 **  License, or (at your option) any later version.
 **
 **  This program is distributed in the hope that it will be useful,
 **  but WITHOUT ANY WARRANTY; without even the implied warranty of
 **  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 **  GNU Affero General Public License for more details.
 **
 **  You should have received a copy of the GNU Affero General Public License
 **  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 **/

var ViewerUtil = {};

(function() {
	"use strict";

	ViewerUtil = function() {};

	ViewerUtil.prototype.getAxisAngle = function(from, at, up) {
		var x3dfrom = new x3dom.fields.SFVec3f(from[0], from[1], from[2]);
		var x3dat = new x3dom.fields.SFVec3f(at[0], at[1], at[2]);
		var x3dup = new x3dom.fields.SFVec3f(up[0], up[1], up[2]);

		var viewMat = x3dom.fields.SFMatrix4f.lookAt(x3dfrom, x3dat, x3dup).inverse();

		var q = new x3dom.fields.Quaternion(0.0, 0.0, 0.0, 1.0);
		q.setValue(viewMat);

		q = q.toAxisAngle();

		return Array.prototype.concat(q[0].toGL(), q[1]);
	};
	
	ViewerUtil.prototype.quatLookAt = function (up, forward)
	{
		forward.normalize();
		up.normalize();

		var right = forward.cross(up);
		up = right.cross(forward);

		var w = Math.sqrt(1 + right.x + up.y + forward.z) * 0.5;
		var recip = 1 / (4 * w);
		var x = (forward.y - up.z) * recip;
		var y = (right.z - forward.y) * recip;
		var z = (up.x - right.y) * recip;

		return new x3dom.fields.Quarternion(x,y,z,w);
	};

	// TODO: Should move this to somewhere more general (utils ? )
	ViewerUtil.prototype.axisAngleToMatrix = function(axis, angle) {
		var mat = new x3dom.fields.SFMatrix4f();

		var cosAngle = Math.cos(angle);
		var sinAngle = Math.sin(angle);
		var t = 1 - cosAngle;

		var v = axis.normalize();

		// As always, should be right hand coordinate system
		/*
		mat.setFromArray( [
			t * v.x * v.x + cosAngle, t * v.x * v.y - v.z * sinAngle, t * v.x * v.z + v.y * sinAngle, 0,
			t * v.x * v.y + v.z * sinAngle, t * v.y * v.y + cosAngle, t * v.y * v.z - v.x * sinAngle, 0,
			t * v.x * v.z - v.y * sinAngle, t * v.y * v.z + v.x * sinAngle, t * v.z * v.z + cosAngle, 0,
			0, 0, 0, 1]);
		*/

		mat.setFromArray([t * v.x * v.x + cosAngle, t * v.x * v.y + v.z * sinAngle, t * v.x * v.z - v.y * sinAngle, 0,
			t * v.x * v.y - v.z * sinAngle, t * v.y * v.y + cosAngle, t * v.y * v.z + v.x * sinAngle, 0,
			t * v.x * v.z + v.y * sinAngle, t * v.y * v.z - v.x * sinAngle, t * v.z * v.z + cosAngle, 0,
			0, 0, 0, 1
		]);

		return mat;
	};

	ViewerUtil.prototype.evDist = function(evt, posA) {
		return Math.sqrt(Math.pow(posA[0] - evt.position.x, 2) +
			Math.pow(posA[1] - evt.position.y, 2) +
			Math.pow(posA[2] - evt.position.z, 2));
	};

	ViewerUtil.prototype.dist = function(posA, posB) {
		return Math.sqrt(Math.pow(posA[0] - posB[0], 2) +
			Math.pow(posA[1] - posB[1], 2) +
			Math.pow(posA[2] - posB[2], 2));
	};

	ViewerUtil.prototype.rotToRotation = function(from, to) {
		var vecFrom = new x3dom.fields.SFVec3f(from[0], from[1], from[2]);
		var vecTo = new x3dom.fields.SFVec3f(to[0], to[1], to[2]);

		var dot = vecFrom.dot(vecTo);

		var crossVec = vecFrom.cross(vecTo);

		return crossVec.x + " " + crossVec.y + " " + crossVec.z + " " + Math.acos(dot);
	};

	ViewerUtil.prototype.rotAxisAngle = function(from, to) {
		var vecFrom = new x3dom.fields.SFVec3f(from[0], from[1], from[2]);
		var vecTo = new x3dom.fields.SFVec3f(to[0], to[1], to[2]);

		var dot = vecFrom.dot(vecTo);

		var crossVec = vecFrom.cross(vecTo);
		var qt = new x3dom.fields.Quaternion(crossVec.x, crossVec.y, crossVec.z, 1);

		qt.w = vecFrom.length() * vecTo.length() + dot;

		return qt.normalize(qt).toAxisAngle();
	};

	// TODO: Shift these to some sort of Matrix/Vec library
	ViewerUtil.prototype.scale = function(v, s) {
		return [v[0] * s, v[1] * s, v[2] * s];
	};

	ViewerUtil.prototype.normalize = function(v) {
		var sz = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
		return this.scale(v, 1 / sz);
	};

	ViewerUtil.prototype.dotProduct = function(a, b) {
		return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
	};

	ViewerUtil.prototype.crossProduct = function(a, b) {
		var x = a[1] * b[2] - a[2] * b[1];
		var y = a[2] * b[0] - a[0] * b[2];
		var z = a[0] * b[1] - a[1] * b[0];

		return [x, y, z];
	};

	ViewerUtil.prototype.vecAdd = function(a, b) {
		return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
	};

	ViewerUtil.prototype.vecSub = function(a, b) {
		return this.vecAdd(a, this.scale(b, -1));
	};
	
	/**
	 * Escape CSS characters in string
	 *
		* @param string
		* @returns {*}
		*/
	ViewerUtil.prototype.escapeCSSCharacters = function(string)
	{
		// Taken from http://stackoverflow.com/questions/2786538/need-to-escape-a-special-character-in-a-jquery-selector-string
		return string.replace(/[!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~]/g, "\\$&");
	};
		
	ViewerUtil = new ViewerUtil();
}());