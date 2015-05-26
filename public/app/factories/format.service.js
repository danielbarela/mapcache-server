angular
  .module('mapcache')
  .factory('FormatService', FormatService);

function FormatService() {

  return {
    geopackage: "Geo Package",
    mbtiles: "MBTiles",
    xyz: "XYZ",
    tms: "TMS",
    geotiff: "GeoTIFF",
    shapefile: "Shapefile",
    geojson: "GeoJSON",
    kml: "KML",
    gpx: "GPX"
  };
}
