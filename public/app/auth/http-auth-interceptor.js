var angular = require('angular');

  angular.module('http-auth-interceptor', ['http-auth-interceptor-buffer'])

  .factory('authService', ['$rootScope','httpBuffer', function($rootScope, httpBuffer) {
    return {
      /**
       * call this function to indicate that authentication was successfull and trigger a
       * retry of all deferred requests.
       * @param data an optional argument to pass on to $broadcast which may be useful for
       * example if you need to pass through details of the user that was logged in
       */
      loginConfirmed: function(data, configUpdater) {
        var updater = configUpdater || function(config) {return config;};
        $rootScope.$broadcast('event:auth-loginConfirmed', data);
        if (!data.newUser) {
          httpBuffer.retryAll(updater);
        } else {
          httpBuffer.retryAllGets(updater);
        }
      }
    };
  }])

  /**
   * $http interceptor.
   * On 401 response (without 'ignoreAuthModule' option) stores the request
   * and broadcasts 'event:angular-auth-loginRequired'.
   */
  .config(['$httpProvider', function($httpProvider) {

    var interceptor = ['$rootScope', '$q', 'httpBuffer', 'LocalStorageService', function($rootScope, $q, httpBuffer, LocalStorageService) {
      return {
        'request': function(request) {
          if (!request.ignoreAuthModule && request.url.lastIndexOf('.html') !== request.url.length - 5) {
            request.headers.authorization = "Bearer " + LocalStorageService.getToken();
          }
          return request;
        },

        'response': function(response) {
          return response;
        },

        'responseError': function(response) {
          if (response.status === 401 && !response.config.ignoreAuthModule) {
            var deferred = $q.defer();
            httpBuffer.append(response.config, deferred);
            $rootScope.$broadcast('event:auth-loginRequired');
            return deferred.promise;
          }
          // otherwise, default behaviour
          return $q.reject(response);
        }
      };

    }];
    $httpProvider.interceptors.push(interceptor);
  }]);

  /**
   * Private module, a utility, required internally by 'http-auth-interceptor'.
   */
  angular.module('http-auth-interceptor-buffer', [])

  .factory('httpBuffer', ['$injector', function($injector) {
    /** Holds all the requests, so they can be re-requested in future. */
    var buffer = [];

    /** Service initialized later because of circular dependency problem. */
    var $http;

    function retryHttpRequest(config, deferred) {
      function successCallback(response) {
        deferred.resolve(response);
      }
      function errorCallback(response) {
        deferred.reject(response);
      }
      $http = $http || $injector.get('$http');
      $http(config).then(successCallback, errorCallback);
    }

    return {
      /**
       * Appends HTTP request configuration object with deferred response attached to buffer.
       */
      append: function(config, deferred) {
        buffer.push({
          config: config,
          deferred: deferred
        });
      },

      /**
       * Retries all the buffered requests clears the buffer.
       */
      retryAll: function(updater) {
        for (var i = 0; i < buffer.length; ++i) {
          retryHttpRequest(updater(buffer[i].config), buffer[i].deferred);
        }
        buffer = [];
      },

      /**
       * Retries only GET requests.  Useful for when a new user has logged in
       * and you do not want to retry POSTing or PUTing or DELTEing data from another user
       */
       retryAllGets: function(updater) {
        for (var i = 0; i < buffer.length; ++i) {
          if (buffer[i].config.method === 'GET') {
            retryHttpRequest(updater(buffer[i].config), buffer[i].deferred);
          } else {
            buffer[i].deferred.reject({});
          }
        }
        buffer = [];
      }
    };
  }]);
