var NetworkViz = (function () {

	var highlightBorder = 1.5;
	var highlightColor = '#d0dee4';

	var f = 32768;

	var nodeLookup = {};
	var nodeList = [];

	var initialized = false;
	var map, labelLayer, highlightLayer;

	var hoveredNode = false;
	var activeNodes = [];

	var clickHandler = false;

	function init() {
		if (!graph) return;// console.error('graph.js not loaded ... yet')

		initialized = true;

		var nodes = graph.nodes;
		var keys = Object.keys(nodes);
		var n = nodes[keys[0]].length;

		for (var i = 0; i < n; i++) {
			var node = {};
			keys.forEach(function (key) {
				node[key] = nodes[key][i];
			})
			node.x += f / 2;
			node.y += f / 2;
			node.lng = node.x;
			node.lat = -node.y;

			if(node.type == 'person'){
				node.color = '#fa7d18';
			}else if(node.mdb){
				node.color = '#fcb52b';
			}else{
				node.color = '#a3db19';
			}

			node.neighbours = [];
			nodeLookup[node.id] = node;
			nodeList.push(node);
		}

		graph.edges.forEach(function (edge) {
			var node1 = nodeList[edge[0]];
			var node2 = nodeList[edge[1]];
			node1.neighbours.push(node2);
			node2.neighbours.push(node1);
		})

		var projection = {
			project: function (latlng) {
				return L.point(latlng.lng / f, -latlng.lat / f);
			},
			unproject: function (point) {
				return L.latLng(-point.y * f, point.x * f);
			},
			bounds: L.bounds(L.point(0, 0), L.point(1, 1))
		};

		var crs = L.extend({}, L.CRS, {
			projection: projection,
			transformation: new L.Transformation(1, 0, 1, 0),
			scale: function (zoom) {
				return 256 * Math.pow(2, zoom);
			}
		});

		$('#networkviz').css({height: '100%'});

		var margin = f;
		map = L.map('networkviz', {
			minZoom: 0,
			maxZoom: 7,
			zoom: 5,
			center: [-0.5 * f, 0.5 * f],
			maxBounds: L.latLngBounds([-f - margin, -margin], [margin, f + margin]),
			crs: crs,
			zoomAnimation: true,
			zoomControl: false,
			scrollWheelZoom: true
		});
		map.addControl(L.control.zoom({position: 'bottomleft'}))


		map.on('mousemove', mousemove);
		map.on('click', mouseclick);

		var layer = L.tileLayer('https://www.lobbyradar.de/lobbynetwork/tiles/{z}/{y}/{x}.png', {
			minZoom: 0,
			maxZoom: 7,
			maxNativeZoom: 7,
			tileSize: 256,
			zoomOffset: 0,
			attribution: '',
			noWrap: true
		})

		layer.addTo(map);


		highlightLayer = L.layerGroup();
		highlightLayer.addTo(map);

		labelLayer = L.layerGroup();
		labelLayer.addTo(map);
	}

	function mousemove(e) {
		var node = findNode(e.latlng);

		if (hoveredNode !== node) {
			if (hoveredNode && !hoveredNode.active) hideLabel(hoveredNode);
			if (node && !node.active) showLabel(node);

			$('#networkviz').css('cursor', node ? 'pointer' : '-webkit-grab');

			hoveredNode = node;
		}
	}

	function mouseclick(e) {
		if (!clickHandler) return;
		var node = findNode(e.latlng);
		if (node) {
			clickHandler(node.id);
			e.originalEvent.preventDefault();
		}
	}

	function findNode(point) {
		var bestNode = false;
		var bestDist = 1e10;

		nodeList.forEach(function (node) {
			var d = Math.sqrt(sqr(node.lng - point.lng) + sqr(node.lat - point.lat));
			if (d < bestDist) {
				bestDist = d;
				bestNode = node;
			}
			;
		});

		var border = Math.pow(0.5, map.getZoom() - 10);

		if (bestDist < bestNode.r + border) return bestNode;
		return false;
	}

	function panToNode(node) {
		var zoom = Math.round(9 - Math.log(node.r) / Math.log(2));

		if (zoom < 3) zoom = 3;
		if (zoom > 7) zoom = 7;

		var latLng = L.latLng(node.lat, node.lng);
		var centerPoint = map.getSize();
		latLng.lng += centerPoint.x * Math.pow(0.5, zoom - 5);

		map.setView(latLng, zoom, {animate: true})
	}

	function clearNodes() {
		activeNodes.forEach(function (node) {
			node.active = false;
			hideLabel(node);
		})
		highlightLayer.clearLayers();
	}

	function ensureLabel(node) {
		if (node.label) return;
		var latLng = L.latLng(node.lat - node.r, node.lng);
		node.label = L.label(latLng, {text: node.name});
		node.label.addTo(labelLayer);
	}

	function showLabel(node) {
		ensureLabel(node);
		node.label.show();
	}

	function hideLabel(node) {
		node.label.hide();
	}

	function activateNode(node) {
		console.log(node);
		node.active = true;
		activeNodes.push(node);
		showLabel(node);

		var center = L.latLng(node.lat, node.lng);

		node.neighbours.forEach(function (neighbour) {
			highlightLayer.addLayer(
				L.line(
					[center, L.latLng(neighbour.lat, neighbour.lng)],
					{stroke: true, fill: false, color: highlightColor, highlight: true, _weight: 1}
				)
			)
		})

		node.neighbours.forEach(function (neighbour) {
			highlightLayer.addLayer(
				L.bubble(
					L.latLng(neighbour.lat, neighbour.lng), neighbour.r,
					{stroke: false, fill: true, fillColor: highlightColor, highlight: true, fillOpacity: 1.0}
				)
			)
		})

		highlightLayer.addLayer(
			L.bubble(
				center, node.r,
				{stroke: false, fill: true, fillColor: node.color, highlight: true, fillOpacity: 1.0}
			)
		)

		node.neighbours.forEach(function (neighbour) {
			highlightLayer.addLayer(
				L.line(
					[center, L.latLng(neighbour.lat, neighbour.lng)],
					{stroke: true, fill: false, color: 'rgb(20,59,82)', _weight: 1}
				)
			)
		})

		node.neighbours.forEach(function (neighbour) {
			highlightLayer.addLayer(
				L.bubble(
					L.latLng(neighbour.lat, neighbour.lng), neighbour.r,
					{stroke: false, fill: true, fillColor: neighbour.color, fillOpacity: 1.0}
				)
			)
		})

		highlightLayer.addLayer(
			L.bubble(
				center, node.r,
				{stroke: false, fill: true, fillColor: highlightColor, fillOpacity: 1.0}
			)
		)

	}

	function highlightNode(node) {
		clearNodes();
		activateNode(node);
		panToNode(node);
	}

	function setClickHandler(func) {
		clickHandler = func;
	}

	function lookupId(id, callback) {
		if (!initialized) init();
		var node = nodeLookup[id];
		if (!node) return; // console.error('id not found "'+id+'"');
		callback(node);
	}

	function sqr(v) {
		return v * v;
	}

	L.Label = L.Class.extend({

		includes: L.Mixin.Events,

		options: {
			text: 'text'
		},

		label: false,
		visible: true,

		initialize: function (latlng, options) {
			L.setOptions(this, options);
			this._latlng = L.latLng(latlng);
		},

		_layerAdd: function (a) {
			this.onAdd(a.target);
		},

		_initLabel: function () {
			this.label = $('<div class="leaflet-label"></div>');
			this.label.text(this.options.text);
			if (this.options.text.length > 30) this.label.addClass('small');

			var panes = this._map._panes;

			$(panes.markerPane).append(this.label);
		},

		update: function () {
			if (this.label) {
				var pos = this._map.latLngToLayerPoint(this._latlng).round();
				this.label.css({
					left: pos.x - this.label.outerWidth() / 2,
					top: pos.y + 10
				});
			}

			return this;
		},

		onAdd: function (map) {
			this._map = map;

			map.on('viewreset', this.update, this);

			this._initLabel();
			this.update();
			this.fire('add');
		},

		addTo: function (map) {
			map.addLayer(this);
			return this;
		},

		show: function () {
			if (!this.label) return;
			this.visible = true;
			this.label.removeClass('hidden');
			this.update();
		},

		hide: function () {
			if (!this.label) return;
			this.visible = false;
			this.label.addClass('hidden');
		}
	});

	L.label = function (latlng, options) {
		return new L.Label(latlng, options);
	};

	L.Bubble = L.Circle.extend({
		_project: function () {

			var map = this._map;

			this._point = map.latLngToLayerPoint(this._latlng);
			this._radius = this._mRadius * Math.pow(2, map.getZoom() - 7);
			if (this.options.highlight) this._radius += highlightBorder;
			this._radiusY = false;

			this._updateBounds();
		}
	});

	L.bubble = function (latlng, radius, options) {
		return new L.Bubble(latlng, radius, options);
	};

	L.Line = L.Polyline.extend({
		_project: function () {
			var weight = this.options._weight * Math.pow(2, this._map.getZoom() - 6);
			if (this.options.highlight) weight += 2 * highlightBorder;
			this.setStyle({weight: weight})

			L.Polyline.prototype._project.call(this);
		}
	});

	L.line = function (latlngs, options) {
		return new L.Line(latlngs, options);
	};

	return {
		highlightEntity: function (id) {
			console.log(id);
			lookupId(id, highlightNode)
		},
		panToEntity: function (id) {
			lookupId(id, panToNode)
		},
		setClickHandler: setClickHandler
	}
})();
