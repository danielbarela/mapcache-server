var CacheModel = require('../../models/cache.js')
  , path = require('path')
  , fs = require('fs-extra');

exports.getCacheData = function(cache, minZoom, maxZoom, callback) {
  var geoPackageFile = path.join(config.server.cacheDirectory.path, cache._id, cache._id + ".gpkg");
  if (!fs.existsSync(geoPackageFile)) {
    var child = require('child_process').fork('api/caches/creator.js');
    child.send({operation:'generateCache', cache: cache, format: 'geopackage', minZoom: minZoom, maxZoom: maxZoom});
    callback(null, {creating: true});
  } else {
    var stream = fs.createReadStream(geoPackageFile);
    callback(null, stream);
  }
}

exports.createCache = function(cache, minZoom, maxZoom, callback) {
  var geoPackageFile = path.join(config.server.cacheDirectory.path, cache._id, cache._id + ".gpkg");
  CacheModel.updateFormatGenerating(cache, 'geopackage', function(err) {
    var python = exec(
      './utilities/geopackage-python-4.0/Packaging/tiles2gpkg_parallel.py -tileorigin ul -srs 3857 ' + path.join(config.server.cacheDirectory.path, cache._id) + " " + geoPackageFile,
      function(error, stdout, stderr) {
        CacheModel.updateFormatCreated(cache, 'geopackage', geoPackageFile, function(err) {
          var stream = fs.createReadStream(geoPackageFile);
          callback(null, stream);
        });
      }
    );
  });
}
