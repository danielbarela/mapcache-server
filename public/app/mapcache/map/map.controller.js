angular
  .module('mapcache')
  .controller('MapController', MapController);

MapController.$inject = [
  '$scope',
  '$location',
  '$timeout',
  '$routeParams',
  '$rootScope',
  '$filter',
  'CacheService',
  'MapService',
  'TileUtilities',
  'LocalStorageService'
];

function MapController($scope, $location, $timeout, $routeParams, $rootScope, $filter, CacheService, MapService, TileUtilities, LocalStorageService) {

  $scope.token = LocalStorageService.getToken();
  $scope.mapOptions = {
    baseLayerUrl: 'http://mapbox.geointapps.org:2999/v4/mapbox.light/{z}/{x}/{y}.png',
    opacity: .14
  };

  $rootScope.title = 'Map';
  $scope.map = {
    id: $routeParams.mapId
  };

  var cacheHighlightPromise;
  $scope.mouseOver = function(cache) {
    $rootScope.$broadcast('showCacheExtent', cache);
    if (cacheHighlightPromise) {
      $timeout.cancel(cacheHighlightPromise);
    }
    cacheHighlightPromise = $timeout(function() {
      $rootScope.$broadcast('showCache', cache);
    }, 500);
  }

  $scope.mouseOut = function(cache) {
    $rootScope.$broadcast('hideCacheExtent', cache);

    if (cacheHighlightPromise) {
      $timeout.cancel(cacheHighlightPromise);
      cacheHighlightPromise = undefined;
    }
    $rootScope.$broadcast('hideCache', cache);
  }

  $scope.getOverviewTilePath = TileUtilities.getOverviewTilePath;

  var allCaches;

  if ($routeParams.mapId) {
    MapService.getCachesForMap($scope.map, function(caches) {
      allCaches = caches;
      $scope.caches = caches;
    });
  }

  $scope.createCacheFromMap = function() {
    $location.path('/create/'+$routeParams.mapId);
  }

  $scope.$on('cacheFilterChange', function(event, filter) {
    $scope.caches = $filter('filter')($filter('filter')(allCaches, filter.cacheFilter), filter.mapFilter);
  });

  function getMap() {
    MapService.refreshMap($scope.map, function(map) {
      // success
      $scope.map = map;
      $rootScope.title = map.name;
      if (!map.status.complete && $location.path().startsWith('/map')) {
        $timeout(getMap, 5000);
      } else {
        if (map.vector) {
          $scope.mapOptions.opacity = 1;
          $scope.map.style = $scope.map.style || {styles:[], defaultStyle: {style: angular.copy(defaultStyle)}};
        }
      }
    }, function(data) {
      // error
    });
  }

  getMap();

};