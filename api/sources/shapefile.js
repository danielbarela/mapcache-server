var SourceModel = require('../../models/source')
  , path = require('path')
  , fs = require('fs-extra')
  , shp2json = require('shp2json');

exports.process = function(source, callback) {
  callback(null, source);
  var child = require('child_process').fork('./processor');
  child.send({operation:'process', sourceId: source.id});
}

exports.getTile = function(source, z, x, y, params, callback) {
  callback(null);
}

exports.getData = function(source, callback) {
  var dir = path.join(config.server.sourceDirectory.path, source.id);
  var fileName = path.basename(path.basename(source.filePath), path.extname(source.filePath)) + '.geojson';
  var file = path.join(dir, fileName);
  console.log('pull from path', file);

  if (fs.existsSync(file)) {
    fs.readFile(file, callback);
  } else {
    callback(null);
  }
}

exports.processSource = function(source, callback) {
  source.status = "Parsing shapefile";
  source.complete = false;
  source.save(function(err) {
    var stream = fs.createReadStream(source.filePath);

    var dir = path.join(config.server.sourceDirectory.path, source.id);
    var fileName = path.basename(path.basename(source.filePath), path.extname(source.filePath)) + '.geojson';
    var file = path.join(dir, fileName);

  	if (!fs.existsSync(file)) {

  		var outStream = fs.createWriteStream(file);
      outStream.on('close',function(status){
        source.status = "Complete";
        source.complete = true;
        source.save(function(err) {
          console.log('wrote the file');
          callback(err);
        });
  		});
      shp2json(stream).pipe(outStream);
    }
  });
}
