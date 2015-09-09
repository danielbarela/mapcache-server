var mongoose = require('mongoose')
  , config = require('../config.js')
  , shortid = require('shortid');

// Creates a new Mongoose Schema object
var Schema = mongoose.Schema;

var DatasourceSchema = new Schema({
  name: { type: String, required: false },
  url: { type: String, required: false },
  format: { type: String, required: true},
  projection: { type: String, required: false},
  vector: { type: Boolean, required: false, default: false},
  metadata: Schema.Types.Mixed,
  geometry: Schema.Types.Mixed,
  file: {
    name: { type: String, required: false},
    path: { type: String, required: false}
  },
  size: { type: Number, required: false},
  tilesLackExtensions: {type: Boolean, default: false},
  zOrder: { type: Number, required: false, default: -1},
  status: {
    message: { type: String, required: false},
    complete: {type: Boolean, required: true, default: false},
    totalFeatures: {type: Number, required: true, default: 0}
  },
  properties: Schema.Types.Mixed,
  style: Schema.Types.Mixed,
  styleTime: { type: Number, required: false, default: 1 }
});

var SourceSchema = new Schema({
	name: { type: String, required: false },
  dataSources: [DatasourceSchema],
	projection: { type: String, required: false},
  size: { type: Number, required: false},
  tileSizeCount: { type: Number, required: false},
  tileSize: { type: Number, required: false, default: 0},
	humanReadableId: { type: String, required: false},
	geometry: Schema.Types.Mixed,
  style: Schema.Types.Mixed,
  properties: Schema.Types.Mixed,
  styleTime: { type: Number, required: false, default: 1 },
	projections: Schema.Types.Mixed,
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

exports.updateDatasource = function(datasource, callback) {

  exports.getSourceByDatasourceId(datasource._id, function(err, source) {
    if (err) {
      console.log('Could not update source', err);
      return callback(err);
    }
    var set = {};
    set['dataSources.$.styleTime'] = Date.now();
    if (datasource.name) set['dataSources.$.name'] = datasource.name;
    if (datasource.url) set['dataSources.$.url'] = datasource.url;
    if (datasource.format) set['dataSources.$.format'] = datasource.format;
    if (datasource.projection) set['dataSources.$.projection'] = datasource.projection;
    if (datasource.vector) set['dataSources.$.vector'] = datasource.vector;
    if (datasource.metadata) set['dataSources.$.metadata'] = datasource.metadata;
    if (datasource.geometry) set['dataSources.$.geometry'] = datasource.geometry;
    if (datasource.file) {
      for (var key in datasource.file) {
        if (datasource.file[key]) {
          set['dataSources.$.file.'+key] = datasource.file[key];
        }
      }
    }
    if (datasource.size) set['dataSources.$.size'] = datasource.size;
    if (datasource.tilesLackExtensions) set['dataSources.$.tilesLackExtensions'] = datasource.tilesLackExtensions;
    if (datasource.zOrder) set['dataSources.$.zOrder'] = datasource.zOrder;
    if (datasource.status) {
      for (var key in datasource.status) {
        if (datasource.status[key]) {
          set['dataSources.$.status.'+key] = datasource.status[key];
        }
      }
    }
    if (datasource.properties) set['dataSources.$.properties'] = datasource.properties;
    if (datasource.style) {
      for (var key in datasource.style) {
        if (datasource.style[key]) {
          set['dataSources.$.style.'+key] = datasource.style[key];
        }
      }
    }

    Source.update(
      {_id: source._id, 'dataSources._id': datasource._id},
      {
        '$set': set
      },
      function(err, source) {
        console.log('err saving the datasource', err);
        exports.getDataSourceById(datasource._id, function(err, datasource) {
          callback(err, datasource);
        });
      }
    );
  });
}

exports.getSourceByDatasourceId = function(id, callback) {
  var dataSource = {"dataSources": {"$elemMatch": {_id: id}}};
  Source.findOne(dataSource, function(err, source) {
    if (err) return callback(err);
    callback(err, source);
  });
}

exports.getDataSourceById = function(id, callback) {

  var dataSource = {"dataSources": {"$elemMatch": {_id: id}}};
  var fields = {dataSources: true};
  Source.findOne(dataSource, fields, function(err, source) {
    if (err) return callback(err);
    if (!source.dataSources || !source.dataSources.length) return callback(err, null);

    for (var i = 0; i < source.dataSources.length; i++) {
      if (source.dataSources[i]._id.toString() == id) {
        return callback(null, source.dataSources[i]);
      }
    }
    callback(err, null);
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
  // for now just update all of the datasource style times when the source is saved
  for (var i = 0; i < update.dataSources.length; i++) {
    update.dataSources[i].styleTime = update.styleTime;
  }
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
