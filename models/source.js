var mongoose = require('mongoose')
  , config = require('../config.js')
  , shortid = require('shortid');

// Creates a new Mongoose Schema object
var Schema = mongoose.Schema;

var SourceSchema = new Schema({
	name: { type: String, required: false },
  dataSources: [{
    name: { type: String, required: false },
    url: { type: String, required: false },
    format: { type: String, required: true},
    projection: { type: String, required: false},
    vector: { type: Boolean, required: false, default: false},
    metadata: Schema.Types.Mixed,
    geometry: Schema.Types.Mixed,
    filePath: { type: String, required: false},
    tilesLackExtensions: {type: Boolean, default: false},
    zOrder: { type: Number, required: true, default: -1}
  }],
	projection: { type: String, required: false},
  size: { type: Number, required: false},
  tileSizeCount: { type: Number, required: false},
  tileSize: { type: Number, required: false, default: 0},
	humanReadableId: { type: String, required: false},
	geometry: Schema.Types.Mixed,
  style: Schema.Types.Mixed,
  styleTime: { type: Number, required: false, default: 1 },
	projections: Schema.Types.Mixed,
  properties: Schema.Types.Mixed,
  status: {
    message: { type: String, required: false},
		complete: {type: Boolean, required: true, default: false},
		totalTiles: {type: Number, required: true, default: 0},
		generatedTiles: {type: Number, required: true, default: 0},
		totalFeatures: {type: Number, required: true, default: 0},
		generatedFeatures: {type: Number, required: true, default: 0},
		zoomLevelStatus: Schema.Types.Mixed
	},
  tilesLackExtensions: {type: Boolean, default: false},
  format: { type: String, required: false},
  filePath: { type: String, required: false},
  vector: { type: Boolean, required: false},
  wmsGetCapabilities: Schema.Types.Mixed,
  wmsLayer: Schema.Types.Mixed,
  url: { type: String, required: false }
});

function transform(source, ret, options) {
	ret.id = ret._id;
	delete ret._id;
	delete ret.__v;
	delete ret.filePath;
  ret.mapcacheUrl = ['/api/sources', source.id].join("/");
  ret.cacheTypes = config.sourceCacheTypes[ret.format];
}

SourceSchema.set("toJSON", {
  transform: transform
});

var Source = mongoose.model('Source', SourceSchema);
exports.sourceModel = Source;

exports.getSources = function(options, callback) {
  var query = options || {};
	Source.find(query).exec(function(err, sources) {
    if (err) {
      console.log("Error finding sources in mongo: " + id + ', error: ' + err);
    }
    callback(err, sources);
  });
}

exports.updateSourceAverageSize = function(source, size, callback) {
  var update = {$inc: {}};
  update.$inc['tileSizeCount'] = 1;
  if (source.tileSize == 0){
    update.tileSize = size;
  } else {
    update.$inc['tileSize'] = size;
  }
  Source.findByIdAndUpdate(source.id, update, callback);
}

exports.getSourceById = function(id, callback) {
  Source.findById(id).exec(function(err, source) {
    if (err) {
      console.log("Error finding source in mongo: " + id + ', error: ' + err);
    }
		if (source) {
      source.cacheTypes = config.sourceCacheTypes[source.format];
	    return callback(err, source);
		}
		// try to find by human readable
		Source.findOne({humanReadableId: id}, function(err, source) {
      if (source) {
        source.cacheTypes = config.sourceCacheTypes[source.format];
      }
		  return callback(err, source);
		});
  });
}

exports.getSourceNoProperties = function(id, callback) {
  Source.findById(id, {properties: 0}).exec(function(err, source) {
    if (err) {
      console.log("Error finding source in mongo: " + id + ', error: ' + err);
    }
    return callback(err, source);
  });
}

exports.updateSource = function(id, update, callback) {
  update.styleTime = Date.now();
  Source.findByIdAndUpdate(id, update, function(err, updatedSource) {
    if (err) console.log('Could not update source', err);
    callback(err, updatedSource)
  });
}

exports.createSource = function(source, callback) {
	source.humanReadableId = shortid.generate();
	Source.create(source, callback);
}

exports.deleteSource = function(source, callback) {
	Source.remove({_id: source.id}, callback);
}
