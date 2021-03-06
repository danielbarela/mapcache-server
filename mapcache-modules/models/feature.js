var knex = require('./db/knex')
	, turf = require('turf')
  , async = require('async')
	, proj4 = require('proj4');

exports.createFeature = function(feature, featureOwnerProperties, callback) {
  var gj = JSON.stringify(feature.geometry);
	var envelope = turf.envelope(feature.geometry);
  knex(function(knex) {
		knex('features')
		.insert({
			source_id: featureOwnerProperties.sourceId, // jshint ignore:line
			cache_id: featureOwnerProperties.cacheId, // jshint ignore:line
			layer_id: featureOwnerProperties.layerId, // jshint ignore:line
			properties: feature.properties,
			geometry: knex.raw('ST_Transform(ST_Intersection(ST_SetSRID(ST_Force_2D(ST_MakeValid(ST_GeomFromGeoJSON(\''+gj+'\'))), 4326), ST_MakeEnvelope(-180, -85, 180, 85, 4326)), 3857)'),
			box: knex.raw('ST_SetSRID(ST_Force_2D(ST_GeomFromGeoJSON(\''+JSON.stringify(envelope.geometry) +'\')), 4326)')
		}).then(callback);
	});
};

exports.getExtentOfSource = function(query, callback) {
	knex(function(knex) {
		knex('features')
		.select(knex.raw('ST_AsGeoJSON(ST_Transform(ST_SetSRID(ST_Extent(geometry), 3857), 4326)) as extent'))
		.where({source_id: query.sourceId, cache_id:null})  // jshint ignore:line
		.then(callback);
	});
};

exports.getAllPropertiesFromSource = function(query, callback) {
  var properties = [];
  exports.getPropertyKeysFromSource(query, function(propertyKeys) {
    async.eachSeries(propertyKeys, function(key, keyComplete) {
      exports.getValuesForKeyFromSource(key.property, query, function(values) {
        var valueArray = values.map(function(value) { return value.value; });
        properties.push({key: key.property, values: valueArray});
        keyComplete();
      });
    }, function done() {
      callback(properties);
    });
  });
};

exports.getPropertyKeysFromSource = function(query, callback) {
	if (!query.layerId) query.layerId = null;
  if (query.sourceId) query.sourceId = query.sourceId.toString();
	knex(function(knex) {
		knex('features')
		.distinct(knex.raw('json_object_keys(properties) as property'))
		.select()
		.where({source_id: query.sourceId, layer_id: query.layerId, cache_id: null}) // jshint ignore:line
		.then(callback);
	});
};

exports.getValuesForKeyFromSource = function(key, query, callback) {
	if (!query.sourceId) query.sourceId = null;
	if (!query.layerId) query.layerId = null;
  if (query.sourceId) query.sourceId = query.sourceId.toString();
	knex(function(knex) {
		knex('features')
		.distinct(knex.raw('properties::jsonb -> \''+key+'\' as value'))
		.select()
		.where({source_id: query.sourceId, layer_id: query.layerId, cache_id: null}) // jshint ignore:line
		.andWhere(knex.raw("properties::jsonb\\?|array[\'"+key+"\']"))
		.then(callback);
	});
};

exports.deleteFeaturesByCacheId = function(id, callback) {
	knex(function(knex) {
		knex.where('cache_id', id).from('features').del().then(callback);
	});
};

exports.deleteFeaturesBySourceId = function(id, callback) {
	knex(function(knex) {
			knex.where('source_id', id).from('features').del().then(function(deleteResults){
			callback(deleteResults);
		});
	});
};

exports.getFeatureCount = function(query, callback) {
	knex(function(knex) {
		knex('features')
		.count()
		.where({cache_id: query.cacheId, source_id: query.sourceId}) // jshint ignore:line
		.then(callback);
	});
};

exports.findFeaturesWithin = function(query, west, south, east, north, projection, callback) {
	var whereQuery = {};
	if (query.cacheId) whereQuery.cache_id = query.cacheId; // jshint ignore:line
	if (query.layerId) whereQuery.layer_id = query.layerId; // jshint ignore:line
	if (query.sourceId) whereQuery.source_id = query.sourceId; // jshint ignore:line
	createGeometrySelect(projection, {west: west, south: south, east: east, north: north}, function(geometrySelect){
		knex(function(knex) {
				knex.select(geometrySelect, 'properties')
			.from('features')
			.whereRaw('ST_Intersects(box, ST_MakeEnvelope('+west+","+south+","+east+","+north+', 4326))')
			.andWhere(whereQuery)
			.then(function(collection){
        collection = collection.map(function(feature) {
          feature.geometry = JSON.parse(feature.geometry);
          if (query.sourceId) {
            feature.properties.mapcache_source_id = query.sourceId;
          }
          return feature;
        });
			  callback(null, collection);
			});
		});
	});
};

exports.findFeaturesByCacheIdWithin = function(cacheId, west, south, east, north, projection, callback) {
	createGeometrySelect(projection, {west: west, south: south, east: east, north: north}, function(geometrySelect){
		knex(function(knex) {
			knex.select(geometrySelect, 'properties')
			.from('features')
			.whereRaw('ST_Intersects(box, ST_MakeEnvelope('+west+","+south+","+east+","+north+', 4326))')
			.andWhere({cache_id: cacheId}) // jshint ignore:line
			.then(function(collection){
        collection = collection.map(function(feature) {
          feature.geometry = JSON.parse(feature.geometry);
          return feature;
        });
		    callback(null, collection);
		  });
		});

	});
};

exports.getAllFeaturesByCacheIdAndSourceId = function(cacheId, sourceId, west, south, east, north, projection, callback) {
	console.log('cacheid %s sourceId %s', cacheId, sourceId);
	createGeometrySelect(projection, {west: west, south: south, east: east, north: north}, function(geometrySelect){
		console.log('cache_id', cacheId);
		console.log('source_id', sourceId);
		knex(function(knex) {
			knex.select(geometrySelect, 'properties')
			.from('features')
			.whereRaw('ST_Intersects(box, ST_MakeEnvelope('+west+","+south+","+east+","+north+', 4326))')
			.andWhere('cache_id', cacheId)
			.andWhere('source_id', sourceId)
			.then(function(collection){
        collection = collection.map(function(feature) {
          feature.geometry = JSON.parse(feature.geometry);
          return feature;
        });
			  callback(null, collection);
			});
		});
	});
};

exports.createCacheFeaturesFromSource = function(sourceId, cacheId, west, south, east, north, callback) {
	knex(function(knex) {
			knex.raw('WITH row AS (SELECT source_id, \''+cacheId + '\' as cache_id, box, geometry, properties FROM features WHERE source_id = \''+ sourceId + '\' and cache_id is null and ST_Intersects(geometry, ST_Transform(ST_MakeEnvelope('+west+','+south+','+east+','+north+', 4326), 3857))) INSERT INTO features (source_id, cache_id, box, geometry, properties) (SELECT * from row)')
		.then(function(collection) {
			callback(null, collection);
		});
	});
};

exports.createCacheFeaturesFromSourceAndLayer = function(sourceId, layerId, cacheId, west, south, east, north, callback) {
	knex(function(knex) {
			knex.raw('WITH row AS (SELECT layer_id, source_id, \''+cacheId + '\' as cache_id, box, geometry, properties FROM features WHERE source_id = \''+ sourceId + '\' and layer_id = \'' + layerId + '\' and cache_id is null and ST_Intersects(geometry, ST_Transform(ST_MakeEnvelope('+west+','+south+','+east+','+north+', 4326), 3857))) INSERT INTO features (source_id, cache_id, box, geometry, properties) (SELECT * from row)')
		.then(function(collection) {
			callback(null, collection);
		});
	});
};

exports.getAllSourceFeatures = function(sourceId, callback) {
	knex(function(knex) {
			knex.raw("select row_to_json(fc) as geojson from (select 'FeatureCollection' as type, array_to_json(array_agg(f)) as features from (select 'Feature' as type, ST_AsGeoJSON(ST_Transform(lg.geometry, 4326))::json as geometry, properties from features as lg where source_id = '"+sourceId+" and cache_id is null') as f) as fc")
		.then(function(collection) {
			callback(null, collection);
		});
	});
};

exports.getAllCacheFeatures = function(cacheId, callback) {
	knex(function(knex) {
			knex.raw("select row_to_json(fc) as geojson from (select 'FeatureCollection' as type, array_to_json(array_agg(f)) as features from (select 'Feature' as type, ST_AsGeoJSON(ST_Transform(lg.geometry, 4326))::json as geometry, properties from features as lg where cache_id = '"+cacheId+"') as f) as fc")
		.then(function(collection) {
			callback(null, collection);
		});
	});
};

exports.writeAllCacheFeatures = function(cacheId, filename, format, callback) {
	if (!callback && typeof format === 'function') {
		callback = format;
		format = null;
	}
	if (!format || format === 'geojson') {
		knex(function(knex) {
				knex.raw("copy(select row_to_json(fc) as geojson from (select 'FeatureCollection' as type, array_to_json(array_agg(f)) as features from (select 'Feature' as type, ST_AsGeoJSON(ST_Transform(lg.geometry, 4326))::json as geometry, properties from features as lg where cache_id = '"+cacheId+"') as f) as fc) to '"+filename+"'")
			.then(function(collection) {
				callback(null, collection);
			});
		});
	}
};

exports.fetchTileForCacheId = function(cacheId, bbox, z, projection, callback) {
	if (!callback && typeof projection === 'function') {
		callback = projection;
		projection = null;
	}
	console.time('fetching data');

	var bufferedBox = {
		west: Math.max(-180, bbox.west - Math.abs((bbox.east - bbox.west) * 0.02)),
		south: Math.max(-85, bbox.south - Math.abs((bbox.north - bbox.south) * 0.02)),
		east: Math.min(180, bbox.east + Math.abs((bbox.east - bbox.west) * 0.02)),
		north: Math.min(85, bbox.north + Math.abs((bbox.north - bbox.south) * 0.02))
	};

	var epsg3857ll = proj4('EPSG:3857', [bbox.west, bbox.south]);
	var epsg3857ur = proj4('EPSG:3857', [bbox.east, bbox.north]);
	console.log('epsg3857ll', epsg3857ll);

	createGeometrySelect(projection, bufferedBox, {west: epsg3857ll[0], south: epsg3857ll[1], east: epsg3857ur[0], north: epsg3857ur[1]}, function(geometrySelect) {

		knex(function(knex) {
			knex.select(geometrySelect, 'properties')
			.from('features')
			.whereRaw('ST_Intersects(box, ST_MakeEnvelope('+bufferedBox.west+","+bufferedBox.south+","+bufferedBox.east+","+bufferedBox.north+', 4326))')
			.andWhere({cache_id: cacheId}) // jshint ignore:line
			.limit(100000)
			.then(function(collection){
				console.timeEnd('fetching data');
				console.log('returned ' + collection.length + ' features');
		    callback(null, collection);
		  });
		});
	});
};

function createGeometrySelect(projection, queryBox, transformationBox, callback) {
	if (!callback && typeof transformationBox === 'function') {
		callback = transformationBox;
		transformationBox = null;
	}
	var geometrySelect;
	if (!projection || projection === 'vector') {
		knex(function(knex) {
			geometrySelect = knex.raw(
				'ST_AsGeoJSON(ST_SimplifyPreserveTopology(ST_TransScale(ST_Intersection(geometry, ST_Transform(ST_MakeEnvelope('+
				 queryBox.west+","+queryBox.south+","+queryBox.east+","+queryBox.north+', 4326),3857)), '+ (-transformationBox.west)+', '+ (-transformationBox.south)+', '+ (4096/(transformationBox.east-transformationBox.west))+', '+ (4096/(transformationBox.north-transformationBox.south)) + '), 16), 1) as geometry'
			);
			callback(geometrySelect);
		});
	} else if (projection === '3857') {
		knex(function(knex) {
			geometrySelect = knex.raw(
				'ST_AsGeoJSON('+
					'ST_Intersection('+
						'geometry, '+
						'ST_Transform('+
							'ST_MakeEnvelope('+
								queryBox.west+","+queryBox.south+","+queryBox.east+","+queryBox.north+
								', 4326'+
							'),'+
						'3857)'+
					') '+
				') as geometry'
			);
			callback(geometrySelect);
		});
	} else {
		knex(function(knex) {
			geometrySelect = knex.raw(
				'ST_AsGeoJSON('+
					'ST_Transform('+
						'ST_Intersection('+
							'geometry, '+
							'ST_Transform('+
								'ST_MakeEnvelope('+
									queryBox.west+","+queryBox.south+","+queryBox.east+","+queryBox.north+
									', 4326'+
								'),'+
							'3857)'+
						') '+
					', '+projection+ ')' +
				') as geometry'
			);
			callback(geometrySelect);
		});
	}
}

exports.fetchTileForSourceId = function(sourceId, bbox, z, projection, callback) {
	if (!callback && typeof projection === 'function') {
		callback = projection;
		projection = null;
	}
	console.time('fetching data');

	var bufferedBox = {
		west: Math.max(-180, bbox.west - Math.abs((bbox.east - bbox.west) * 0.02)),
		south: Math.max(-85, bbox.south - Math.abs((bbox.north - bbox.south) * 0.02)),
		east: Math.min(180, bbox.east + Math.abs((bbox.east - bbox.west) * 0.02)),
		north: Math.min(85, bbox.north + Math.abs((bbox.north - bbox.south) * 0.02))
	};

	var epsg3857ll = proj4('EPSG:3857', [bbox.west, bbox.south]);
	var epsg3857ur = proj4('EPSG:3857', [bbox.east, bbox.north]);
	console.log('epsg3857ll', epsg3857ll);

	createGeometrySelect(projection, bufferedBox, {west: epsg3857ll[0], south: epsg3857ll[1], east: epsg3857ur[0], north: epsg3857ur[1]}, function(geometrySelect) {
		knex(function(knex) {
			knex.select(geometrySelect,'properties')
			.from('features')
			.whereRaw('ST_Intersects(box, ST_MakeEnvelope('+bufferedBox.west+","+bufferedBox.south+","+bufferedBox.east+","+bufferedBox.north+', 4326))')
			.andWhere({source_id: sourceId, cache_id: null}) // jshint ignore:line
			// .limit(100000)
			.then(function(collection){
				console.timeEnd('fetching data');
				console.log('returned ' + collection.length + ' features');
		    callback(null, collection);
		  });
		});
	});
};

exports.fetchTileForSourceIdAndLayerId = function(sourceId, layerId, bbox, z, projection, callback) {
	if (!callback && typeof projection === 'function') {
		callback = projection;
		projection = null;
	}
	console.time('fetching data');

	var bufferedBox = {
		west: Math.max(-180, bbox.west - Math.abs((bbox.east - bbox.west) * 0.02)),
		south: Math.max(-85, bbox.south - Math.abs((bbox.north - bbox.south) * 0.02)),
		east: Math.min(180, bbox.east + Math.abs((bbox.east - bbox.west) * 0.02)),
		north: Math.min(85, bbox.north + Math.abs((bbox.north - bbox.south) * 0.02))
	};

	var epsg3857ll = proj4('EPSG:3857', [bbox.west, bbox.south]);
	var epsg3857ur = proj4('EPSG:3857', [bbox.east, bbox.north]);
	console.log('epsg3857ll', epsg3857ll);

	createGeometrySelect(projection, bufferedBox, {west: epsg3857ll[0], south: epsg3857ll[1], east: epsg3857ur[0], north: epsg3857ur[1]}, function(geometrySelect) {
		knex(function(knex) {
			knex.select(geometrySelect,'properties')
			.from('features')
			.whereRaw('ST_Intersects(box, ST_MakeEnvelope('+bufferedBox.west+","+bufferedBox.south+","+bufferedBox.east+","+bufferedBox.north+', 4326))')
			.andWhere({source_id: sourceId, layer_id: layerId, cache_id: null}) // jshint ignore:line
			// .limit(100000)
			.then(function(collection){
				console.timeEnd('fetching data');
				console.log('returned ' + collection.length + ' features');
		    callback(null, collection);
		  });
		});
	});
};
