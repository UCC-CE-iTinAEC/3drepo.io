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

(function () {
    "use strict";

    angular.module("3drepo")
        .directive("filter", filter);

    function filter() {
        return {
            restrict: 'E',
            templateUrl: 'filter.html',
            scope: {},
            controller: FilterCtrl,
            controllerAs: 'fl',
            bindToController: true
        };
    }

    FilterCtrl.$inject = ["$scope", "$timeout", "EventService"];

    function FilterCtrl($scope, $timeout, EventService) {
        var fl = this;
        fl.filter = null;
        fl.showHelp = false;

        $scope.$watch("fl.filterText", function (newValue) {
            if (angular.isDefined(newValue)) {
                if (fl.filter !== null) {
                    $timeout.cancel(fl.filter);
                }
                fl.filter = $timeout(function() {
                    EventService.send(EventService.EVENT.FILTER, newValue);
                }, 500);
            }
        });

        $scope.$watch(EventService.currentEvent, function (event) {
            if (event.type === EventService.EVENT.TOGGLE_HELP) {
                fl.showHelp = !fl.showHelp;
            }
        });
    }
}());