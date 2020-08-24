var _apiDoc;
var _apiCrses;
var _baseurl = ""
var _collectionsurl = wfs3url + "/collections";
var _collectionId = "";
var _collections = []
var map;
var bboxCrs;
var wfs3layers = [];

function initMap(crsAlias) {
  var options = {};
  var baseLayer = {};
  // just to init the map proper
  if (crsAlias=='RD') {
    // a var set in proj4util.js
    var RD = new L.Proj.CRS( 'EPSG:28992','+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +units=m +towgs84=565.2369,50.0087,465.658,-0.406857330322398,0.350732676542563,-1.8703473836068,4.0812 +no_defs',
        {
            resolutions: [3440.640, 1720.320, 860.160, 430.080, 215.040, 107.520, 53.760, 26.880, 13.440, 6.720, 3.360, 1.680, 0.840, 0.420],
            bounds: L.bounds([-285401.92, 22598.08], [595401.9199999999, 903401.9199999999]),
            origin: [-285401.92, 22598.08]
        }
    );
    options = {
      crs: RD,
      center: [52.1, 5.2], // in lat long
      zoom: 4,
    }
    baseLayer = new L.tileLayer('https://geodata.nationaalgeoregister.nl/tms/1.0.0/brtachtergrondkaart/{z}/{x}/{y}.png', {
        minZoom: 0,
        maxZoom: 13,
        tms: true,
        attribution: 'Map data: <a href="http://www.kadaster.nl">Kadaster</a>'
    });
    bboxCrs=encodeURIComponent("http://www.opengis.net/def/crs/EPSG/0/28992");
  } else {
    options = {
      center: [52.1, 5.2],
      zoom: 9,
    }
    baseLayer = new L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      });
  }

  map = new L.map('map', options);
  baseLayer.addTo(map);
  map.fitBounds(map.getBounds());
  return map;
}

function logUrl(url) {
  $("#log").prepend(new Date().toUTCString() + " -> <a href='"+url+"' target='_blank'>" + url + "</a></br>");
}

function logTxt(txt, level) {
  $("#log").prepend("<span class='"+level+"'>" + new Date().toUTCString() + " -> " + txt + "</span></br>");
}

function setWFS3url(wfs3url) {
  $("#wfs3url").val(wfs3url);
  initWFS3(wfs3url);
}

// init: get the collections of the WFS3 API
function initWFS3(wfs3url) {
  $("#go").prop("disabled", true);
  if (!wfs3url) wfs3url = $("#wfs3url").val();
  $("#collections").html("")
  // Access the API doc and try to process the collections resource
  $.getJSON(wfs3url, function(data) {
    logUrl(wfs3url)
    // TODO: process the limit, use the min value of the current default and the value of the API doc
    // For now: just save the api doc in a variable
    _apiDoc = data;
    if (_apiDoc["crs"]) {
      logTxt("Additional CRSes offered: " + _apiDoc["crs"], "debug")
      _apiCrses = _apiDoc["crs"];
    } else {
      logTxt("No other CRSes offered, default WGS84", "debug")
    }
    _baseurl = wfs3url.replace("/api", "")
    _baseurl = _baseurl.replace("/openapi", "")
    _collectionsurl = _baseurl + "/collections"
    // TODO: get the _collectionsurl from the openapi document
    
    // get the collections of the WFS 3 API
    $.getJSON(_collectionsurl, function(colldata) {
      logUrl(_collectionsurl)
      var cnt = 0;
      for (var c in colldata["collections"]) {
        var coll = colldata["collections"][c];
        // get the name as the id
        var li = "<p id='li_" + coll["name"] + "'>" +
          "<b>" + (coll["title"] || coll["name"]) + "</b><br/>" + (coll["description"] || "") +
          "<br/><button onclick='loadDataInExtent(\"" + coll["name"] + "\")'>Load items in current map view</button>&nbsp;<button onclick='addCollection(\"" + coll["name"] + "\")'>Browse items (random)</button></p>";
        $("#collections").append(li);
        cnt++;
      }
      $("#go").prop("disabled", false);
      $("#collections").prepend("<h2>" + cnt + " collections found</h2>");
    });
  });
}

function loadDataInExtent(collectionId) {
  // TODO: take into account limit = -1? and/or paging?
  // assume limit= default of this demo for now
  _collectionId = collectionId;
  var reqUrl = _collectionsurl + "/" + collectionId + "/items?limit=" + $("#limit")[0].value;
  var bnds = map.getBounds();
  var ll = [bnds["_southWest"].lng, bnds["_southWest"].lat];
  var ur = [bnds["_northEast"].lng, bnds["_northEast"].lat];
  // transform to RD, only RD is supported now
  if (bboxCrs) {
    reqUrl += "&bbox-crs=" + bboxCrs + "&crs=" + bboxCrs; // force RD as output?
    ll = transformToRD(ll);
    ur = transformToRD(ur);
  }
  var bboxStr = ll[0] + "," + ll[1] + "," + ur[0] + "," + ur[1];
  reqUrl += "&bbox=" + bboxStr;

  var from = $("#from")[0].value;
  var to = $("#to")[0].value;

  var delim = "&"
  if( from || to) {
      var append="datetime=";
      if( from ) {
        append = append + new Date(from).toISOString();
      } else {
        append = append + "..";
      }

      append = append + "/";

      if( to ) {
        append = append + new Date(to).toISOString();
      } else {
        append = append + "..";
      }
      reqUrl = reqUrl + delim + append;
  }

  var apikey = $("#apikey")[0].value;
  if( apikey ) {
    reqUrl = reqUrl + delim + "api-key=" + apikey;
  }

  loadWFS3Data(reqUrl, collectionId)
}

function nextData(reqUrl, collectionId) {
  // TODO: remove previous data?
  loadWFS3Data(reqUrl, collectionId);
}

function addCollection(collectionId) {
  _collectionId = collectionId;
  var reqUrl = _collectionsurl + "/" + collectionId + "/items";
  loadWFS3Data(reqUrl, collectionId);
}

// load GeoJSON encoded data from a URL (in fact: from a WFS 3 collection URL)
function loadWFS3Data(reqUrl, collectionId) {
  // http://localhost:5000/collections/pc5/items/?&limit=100
  $.getJSON(reqUrl, function(data) {
    logUrl(reqUrl)
    var wfs3layer = L.geoJSON(data, {
      style: function(feature) {
        // very basic styling..
        return {
          color: "#0000bb"
        };
      }
    }).bindPopup(function(layer) {
      var pp = "<table class='fi'><th colspan='2'>" + collectionId + "</td></th>";
      for (var p in layer.feature.properties) {
        pp += "<tr><td>" + p + "</td><td> " + layer.feature.properties[p] + "</td></tr>"
      }
      pp += "</table>"
      return pp;
    }).addTo(map);
    wfs3layers.push(wfs3layer);
    // add the next and prev URLs if provided in the geojson response
    var liId = "li_" + collectionId
    if ($("#" + liId)) {
      for (var l in data.links) {
        var lnk = data.links[l];
        if (lnk.rel == "next" || lnk.rel == "prev") {
          var btnId = "btn_" + lnk.rel + "_" + collectionId
          var ttl = (lnk.title) ? lnk.title : lnk.rel;
          var btn = "<button id='" + btnId + "' onclick='nextData(\"" + lnk.href + "\", \"" + collectionId + "\")'>" + ttl + "</button>";
          if ($("#" + btnId).length > 0) {
            $("#" + btnId).replaceWith(btn)
          } else {
            $("#" + liId).append(btn)
          }
        }
      }
    }
    // for RD: back to WGS 84
    var newBnds = wfs3layer.getBounds();
    // TODO: transform back for BGT?
    if (bboxCrs) {
      var ll = [newBnds["_southWest"].lng, newBnds["_southWest"].lat];
      var ur = [newBnds["_northEast"].lng, newBnds["_northEast"].lat];
      // transform to RD, only RD is supported now
      ll = transformToWGS84(ll);
      ur = transformToWGS84(ur);
      newBnds = [ll, ur];
    }
    //map.fitBounds(newBnds);
  });
}

function clearlayers() {
    var layer;
    while (layer = wfs3layers.pop())
    {
      map.removeLayer(layer);
    }
}