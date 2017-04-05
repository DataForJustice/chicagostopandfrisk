/*
* Augmented Narrative Toolkit
* Paola Villarreal, 2016.
* paw@paw.mx
*/


ant = {};
ant.charts = {};
/*
* Coordinator. 
* This object coordinates all the interactions in the layout. 
* Initializes the scrolls, the slides, carousels, charts (including maps)
*/
function Ant (conf) {
	this.conf = conf;
	this.charts = {};
	this.chartTypes = {};
	this.scroll = {};
	this.currentScene = null;
	this.currentElement = null;
	this.dataOrder = [];
	this.medium = {};
	this.slides = {};

	this.data = {};

	this.init ();
	return this;
}
Ant.prototype = {
	constructor: Ant,
	/*
	* Init.
	* Parses the configuration: the first task will be to download the data and then init the sliding, the scrolls and the controls.
	*/
	init: function () {
		// TODO define priorities
		if (this.conf.data) {
			var q = queue ();
			for (c in this.conf.data) {
				var d = this.conf.data [c];
				q.defer (d.type, d.url)
				this.dataOrder.push (d.id);
			}
			q.await ($.proxy (this.dataCallback, this));
		} else {
			this.dataCallback ();
		}
		this.initSlides ();
	},
	/*
	* dataCallback.
	* Receives the data in its arguments. 
	* Will initialize the maps and the charts.
	*/
	dataCallback: function () {
		this.initScroll ();
		this.initControls ();
		if (arguments.length > 0) {
			if (arguments [0]) {
				throw arguments [0];
			}
			for (var i = 1; i < arguments.length; i++) {
				var dataName = this.dataOrder [i-1];
				var conf = this.conf.data [dataName];
				if (conf) {
					var data = arguments [i];
					if (conf.processor) { 
						var ret = $.proxy (conf.processor, this) (arguments [i]);
						if (ret) { 
							data = ret;
						}
					}
					this.data [dataName] = data;
				}
			}
		}
		var cb = function (me) { 
			return function (a) {
				me.parseElement.apply (me, [this]);
			}
		}
		$("[data-onload]").each (cb (this));
		this.initCharts ();
	},
	/*
	* scrollProgress.
	* 
	*/
	scrollProgress: function (scene) {
	},
	scrollLeave: function (element) {
		//TODO test this code as it was migrated from this.maps to this.charts
		this.currentElement = null; 
		var data = $(element).data ();
		var controlMap = data ["control_map"];
		if (controlMap) {
			var onClickLayer = $(element).data ("map_click_layer");
			var onClick = $(element).data ("map_click");
			if (onClick && onClickLayer) {
				this.charts [controlMap].topologies [onClickLayer].removeCallback ("click", this.onClick);
			}
		}
		if (data.scroll_leave_parse) { 
			if (Array.isArray (data.scroll_leave_parse)) { 
				for (var x in data.scroll_leave_parse) { 
					this.parseElement (data.scroll_leave_parse [x], false);
				}
			}
			else {
				var me = this;
				$(data.scroll_leave_parse).each (function () { me.parseElement.apply (me, [$(this) [0]], false); });
			}
			
		}
	},
	scrollEnter: function (element) {
		$(element.parentNode).children ().removeClass ("highlight");
		$(element).addClass ("highlight");
		this.parseElement (element);
		$(element).find ("form[data-control]").change ();
		var data = $(element).data ();
		if (data.scroll_enter_parse) { 
			if (Array.isArray (data.scroll_enter_parse)) { 
				for (var x in data.scroll_enter_parse) { 
					this.parseElement (data.scroll_enter_parse [x], false);
				}
			}
			else {
				var me = this;
				$(data.scroll_enter_parse).each (function () { me.parseElement.apply (me, [$(this) [0]], false); });
			}
		}
	},
	/*
	* getCallback
	* returns the callback that will be used 
	*/
	getCallback: function (cbName) {
		if (this.conf.callbacks && this.conf.callbacks [cbName]) {
			return this.conf.callbacks [cbName]; 
		}
	},
	/*
	* parseElement
	*/
	parseElement: function (element) {
		if (!element) throw "There is no element";
		/* 
		* Lets see what we have here: data? should we quantify something?
		*/
		var data;
		if (typeof element === 'string' || element.tagName) { // this is a string or an HTMLElement (check compatibility with other browsers)
			var id = $(element).attr ("id");
			data = $(element).data ();
		} else { 
			id = element.id;
			data = element;
		}
		/*
		* Parse_first
		*/
		if (data.parse_first) { 
			if (Array.isArray (data.parse_first)) { 
				for (var x in data.parse_first) { 
					this.parseElement (data.parse_first [x], false);
				}
			}
			else {
				var me = this;
				$(data.parse_first).each (function () { me.parseElement.apply (me, [$(this) [0]], false); });
			}
		}

		if (data.init_scroll !== undefined) { 
			this.initScroll ();
		}

		/*
		* charts and quantification
		*/

		var quantify = data.quantify;
		var quantifier = data.quantifier;
		var qArgs = data.quantifier_args;
		var controlChart = !data.control_chart ? id : data.control_chart;
		if (controlChart) { 
			var chartType = this.chartType (controlChart); 
			/*
			* If we have to quantify, lets prequantify :)
			*/
			if (quantify && quantifier) {
				var qObj = {fn: quantifier, ar: qArgs};
				try {
					qObj.data = this.prequantify (qObj);
					if (!qObj.data) qObj.data = this.data [quantify];
					if (chartType == "lines" || chartType == "bars" || chartType == "pie" || chartType == "treemap" || chartType == "sunburst" || chartType == "force") {
						this.quantifyChart (controlChart, qObj);
					}
					if (chartType == "map") {
						this.quantifyMap (controlChart, quantify, qObj);
					}
				} catch (e) { console.log (e); console.log (e.stack); }
			}
			if (chartType == "lines" || chartType == "bars" || chartType == "pie" || chartType == "treemap" || chartType == "sunburst" || chartType == "force") {
				this.parseChart (element, data);
			}
			/*
			* Chart: Map.
			*/
			if (chartType == "map") {
				this.parseMap (element, data);
			}
		}
		/*
		* Media
		*/
		if (data.control_media) { 
			var m = this.medium [data.control_media];
			if (m) { 
				if (data.media_play !== undefined) { 
					m.play ();
					m.muted (false);
				}
				if (data.media_stop !== undefined) { 
					m.pause ();
					m.currentTime (0);
				}
				if (data.media_time !== undefined) {
				//	m.pause ();
					m.currentTime (parseInt (data.media_time));
				//	m.play ();
				}
				if (data.media_pause !== undefined) {
					m.pause ();
				}
				if (data.media_mute !== undefined) {
					m.muted (true);
				}
				if (data.media_unmute !== undefined) { 
					m.muted (false);
				}
			}
		}
		/*
		* HTML element
		*/
		if (data.control_element) {
			
			var s = $(data.control_element);
			if (data.element_text) { s.text (data.element_text); }
			if (data.element_add_class) { s.addClass (data.element_add_class); }
			if (data.element_remove_class) { s.removeClass (data.element_remove_class); }
			if (data.element_hide !== undefined) { s.hide (); }
			if (data.element_show !== undefined) { s.show (); }
			if (data.element_toggle !== undefined) { s.toggle (); }
			if (data.element_remove !== undefined) { s.remove (); }
			if (data.element_remove_children !== undefined) { 
				for (var i = 0; i < s.length; i++) {
					var cNode = s [i].cloneNode (false);
					s [i].parentNode.replaceChild (cNode, s [i]); 
				}
			}
			if (data.element_move_to !== undefined) { 
				var idx = parseInt (data.element_move_to) ? parseInt (data.element_move_to) : 0;
				if (data.element_move_to == "first")  { idx = 0; }
				if (data.element_move_to == "last")  { idx = null; }
				for (var i = 0; i < s.length; i++) { 
					var par = s [i].parentNode, elm = par.removeChild (s [i]), sib = par.childNodes;
					par.insertBefore (elm, sib [idx]);
				}
				
			}

			if (data.element_attrs) { 
				//s.attr (data.element_attrs); 
				if (data.element_attrs === Object (data.element_attrs)) { 
					data.element_attrs = Object (data.element_attrs);
					s.attr (data.element_attrs);
				}
			}
		}
		/*
		* Callback
		*/
		if (data.callback) {
			var cb = this.conf.callbacks [data.callback]
			if (cb) {
				try { 
					cb.apply (this, [data.callback_args]);
				} catch (e) { 
					console.log ("error in callback: " + e);
					console.log (e.stack);
				}
			}
		}
		/*
		* Hide and show.
		*/
		if (data.hide !== undefined) {
			if (data.hide == "") { 
				$(element).hide (); $(element).css ("visibility", "hidden"); 
			} else if (data.hide.split) { 
				var x = data.hide.split (",");
				for (var d in x) { 
					$("#" + x [d]).hide (); 
					$("#" + x [d]).css ("visibility", "hidden"); 
				}
			}
		}
		if (data.show !== undefined) {
			if (data.show == "") { 
				$(element).show (); 
				$(element).css ("visibility", "visible"); 
			} else if (data.hide.show) { 
				var x = data.show.split (",");
				for (var d in x) { 
					$("#" + x [d]).show (); 
					$("#" + x [d]).css ("visibility", "visible"); 
				}
			}
		}
		/*
		* Scroll control
		*/
		if (data.control_scroll != '' && this.scroll [data.control_scroll]) { 
			var scroll = this.scroll [data.control_scroll];
			if (data.scroll_to !== undefined) { 
				scroll.scrollTo (data.scroll_to);
			}
			if (data.scroll_to_next !== undefined) { 
				scroll.scrollToNext ();
			}
			if (data.scroll_to_previous !== undefined) { 
				scroll.scrollToPrev ();
			}
		}
		/*
		* Slide control
		*/
		if (data.control_slide != '' && this.slides [data.control_slide]) {
			if (data.scroll_to !== undefined) { 
				this.slides [data.control_slide].controller.scrollTo (this.slides [data.control_slide].slides [data.scroll_to]);
			}
		}
		if (data.debug) { 
			console.log (data.debug);
		}
		/*
		* data catalogs 
		*/
		if (data.catalog) {
			if (!this.data [data.catalog] && !this.callbacks [data.catalog]) throw "No catalog " + data.catalog + " in data collection"; 
			var dt = this.data [data.catalog];
			if (!dt && this.callbacks && this.callbacks [data.catalog]) dt = this.callbacks [data.catalog].apply (this, [data.catalog_args]);
			var container = d3.selectAll (data.element_container);
			var cols = data.columns === undefined && dt.columns !== undefined ? dt.columns : (data.columns !== undefined ? data.columns : [0])
			if (data.column_names) { 
				var elm = container.append (data.create_element);
				if (data.item_element) { 
					elm = elm.append (data.item_element);
				}
				for (var a in cols) {
					elm.append (data.item_element).html (cols [a]);
				}
			}
			for (var x in dt) {
				var elm = container.append (data.create_element);
				if (data.element_attrs) {
					var attrs = {};
					for (var a in data.element_attrs) {
						attrs [a] = dt [x] [data.element_attrs [a]];
					}
					elm.attrs (attrs);
				}
				if (data.element_html) {
					elm.html (dt [x] [data.element_html]);
				}
				if (data.item_element) {
					for (var a in cols) {
						elm.append (data.item_element).html (dt [x][cols [a]]);
					}
				}

			}

		}

		/*
		* Data download and parsing
		*/
		if (data.download) {
			var q = queue (), queryData = {}, type = data.type ? data.type : "csv";
			if (!type) type = "csv";
			if (data.query_string_elements) {
				var sel = document.querySelectorAll (data.query_string_elements);
				for (var e in sel) {
					if (sel [e].name != undefined) {
						if ((sel [e].type == "checkbox" && sel [e].checked) || (sel [e].type != "checkbox")) {
							queryData [sel [e].name] = sel [e].value;
						}
					}
				}
			}
			if (data.query_string_form) {
				var form = document.getElementById (data.query_string_form)  
				if (form && form.elements.length > 0) {
					for (var elm in form.elements) {
						//queryData.push ({elm: form.elements [elm].value});
						if (form.elements [elm].name != undefined) {
							if ((form.elements [elm].type == "checkbox" && form.elements [elm].checked) || (form.elements [elm].type != "checkbox")) {
								queryData [form.elements [elm].name] = form.elements [elm].value;
							}
						}
					}
				}
			}
			var queryString = Object.keys(queryData).reduce(function(a,k){a.push(k+'='+encodeURIComponent(queryData[k]));return a},[]).join('&'),method = data.download_method ? data.download_method.toLowerCase() : "get";
			var request = d3.request ((method == "get" && queryString) ? data.download+"?"+queryString : data.download ); 
			if (type == "json") {
				request = request
					.mimeType ("text/json")
					.response (function (xhr) { return JSON.parse(xhr.responseText); });
			}
			if (type == "csv") { 
				request = request
					.mimeType("text/csv")
					.response(function(xhr) { return d3.csvParse (xhr.responseText); })
			}
			q.defer (request [method], queryString);
			q.await ($.proxy (function (err, d) { 
				if (this.conf.callbacks && data.download_processor && this.conf.callbacks [data.download_processor]) {
					d = this.conf.callbacks [data.download_processor].apply (this, [d, data.download_id]); 
				}

				this.data [data.download_id] = d; 

				if (data.download_parse) {
					var me = this;
					$(data.download_parse).each (function () { me.parseElement.apply (me, [$(this) [0]]); });
				}
				if (data.download_parse_sequence) {
					var me = this, x = data.download_parse_sequence.split (',');
					for (var e in x) { 
						$(x [e]).each (function () { me.parseElement.apply (me, [$(this) [0]], false);})
					}
				}
			}, this));
		}
		/* data process */
		if (data.process) { 
			
		}
		/*
		* Other elements to parse
		*/
		if (data.parse) { 
			if (Array.isArray (data.parse)) { 
				for (var x in data.parse) { 
					this.parseElement (data.parse [x], false);
				}
			}
			else {
				var me = this;
				$(data.parse).each (function () { me.parseElement.apply (me, [$(this) [0]], false); });
			}
		}
		/*
		* This is a comma separated value and each of the elements will be treated as an independent selector and parsed in sequence
		*/
		if (data.parse_sequence) {
			var x = data.parse_sequence.split (",");
			var me = this;
			for (var e in x) {
				$(x[e]).each  (function () { me.parseElement.apply (me, [$(this) [0]], false); });
			}
		}
		/*
		* IMPORTANT! DO not put any more code here as we need to make sure that the other elements are parsed after everything else, to avoid weird behaviour. 
		*/
	},
	prequantify: function (quantifier) {
		if (this.conf.prequantifiers) {
			var pq = quantifier ? this.conf.prequantifiers [quantifier.fn] : null;
			if (pq) { 
				return pq.apply (this, [quantifier.ar]);
			}
		}
	},
	parseChart: function (element, data) {
		var id = $(element).attr ("id");
		var controlChart = data.control_chart ? data.control_chart : id;
		if (!controlChart) throw "No control_chart defined in element: " + element;
		var highlight = data.highlight;
		if (highlight) { 
			this.charts [controlChart].removeClass (".highlight", "highlight");
			this.charts [controlChart].addClass (data.highlight, "highlight");
		}
	},
	/*
	*
	*/
	parseMap: function (element, data) {
		var id = $(element).attr ("id");
		var controlChart = data.control_chart ? data.control_chart : id;
		if (!controlChart) throw "No control_chart defined in element: " + element;

		if (data.clear) {
			var layers = data.clear.split(',');
			for (var l in layers) {
				this.quantifyMap (controlChart, layers [l.trim()], {fn: function () { return {"class": ""} } });
			}
		}
		if (data.add_layer)  {
			var plot = data.layer_points !== undefined ? "points" : "lines";
			this.charts [controlChart].addFeatures (data.add_layer, this.data [data.add_layer], data.layer_key).redraw (function () { }, {fn: function (a) { return {"r": 2}  } }, plot);
		}
		var zoomTo = data.zoom_to;
		var zoomLevel = data.zoom_level; 
		if (data.map_center_lat && data.map_center_lon) { 
			this.charts [controlChart].setCenter ({lat: data.map_center_lat, lon: data.map_center_lon});
		}
		if (zoomTo) {
			this.charts [controlChart].zoomTo (zoomTo, zoomLevel);
		} else if (zoomLevel) {
			this.charts [controlChart].setScale (zoomLevel); 
		}
		if (data.select) { 
			if (data.select_add_class) { 
				this.charts [controlChart].addClass (data.select, data.select_add_class);
			}
			if (data.select_remove_class) { 
				this.charts [controlChart].removeClass (data.select, data.select_remove_class);
			}
		}
		var highlight = data.highlight;
		if (highlight) { 
			this.charts [controlChart].removeClass (".highlight", "highlight");
			this.charts [controlChart].addClass (data.highlight, "highlight");
		}

	},
	/*
	* quantiyChart:
	* 	starts up the quantifying process by calling the charts native 'redraw' method with the quantifier.
	*	Arguments:
	*		chart: string, the chart container's id.
	*		quantify: string, the key found in the 'data' config object 
	*		quantifier: object, the function that is going to quantify it and its arguments.
	*/
	quantifyChart: function (chart /* where is it going to be displayed*/, quantifier /* who is going to quantify it */) {
		var chartType = this.chartType (chart);
		if (this.conf.quantifiers && this.conf.quantifiers [chartType]) {
			var q = quantifier ? this.conf.quantifiers [chartType] [quantifier.fn] : null;
		}
		if (!q && quantifier) throw "No quantifier found: " + chartType + " " + quantifier.fn;
		var qn = quantifier ? {fn: q, context: this, args: quantifier.ar, data: quantifier.data} : null;
		this.charts [chart].redraw (quantifier.data, qn);
		this.charts [chart].on ("click", function (a, id, x, el) { this.parseElement (el); }, this); 
		this.charts [chart].on ("mouseover", function (a, id, x, el) { this.parseElement (el); }, this); 
		//this.charts [chart].on ("mouseout", function (a, id, x, el) { this.parseElement (el); }, this); 
	},
	quantifyMap: function (map, layer, quantifier) {
		if (this.conf.quantifiers && this.conf.quantifiers ["maps"]) {
			var q = quantifier ? this.conf.quantifiers ["maps"] [quantifier.fn] : null;
		}
		if (!q && quantifier) q = quantifier.fn; 
		var qn = quantifier ? {fn: q, context: this, args: quantifier.ar, data: quantifier.data} : null;
		if (!this.charts [map].topologies[layer]) throw "No layer: "+layer + " for map: " + map;

		/*
		* This is where the difference between maps and normal charts resides: maps have different layers and we just want to quantify one of them here.
		*/
		var l = this.charts [map].topologies [layer];
		var plot = l.plot ? l.plot : "lines"
		l.redraw (null, qn, plot);
		l.on ("click", function (a, id, x, el) { this.parseElement (el); }, this); 
		l.on ("mouseover", function (a, id, x, el) { this.parseElement (el); }, this); 
		//l.on ("mouseout", function (a, id, x, el) { this.parseElement (el); }, this); 
		this.charts [map].reZoom ();
	},
	setFeatureId: function (layer) {
		return function (x) { 
			var val = x.properties [layer.idProperty];
			if (typeof layer.idProperty === "function") {
				val = layer.idProperty (x); 
			}
			return layer.id + "_" + val;
		};
	},
	initControls: function () {
		$("form[data-control]").change({me: this},
			function (a) {
				var args = {};
				$.each ($(this).find (":input").serializeArray (), function (_, kv) { if (kv.value != "IGNORE") { args [kv.name] = kv.value; } });
				$(this).data ("quantifier_args", args);
				a.data.me.parseElement.apply (a.data.me, [this, false]);
			}
		);
		//TODO check if this is redundant from the method above
		$("select[data-control]").change ({me: this},
			function (a) {
				var sel = this;
				for (var i = 0; i < sel.options.length; i++) {
					if (sel.options [i].selected) {
						a.data.me.parseElement.apply (a.data.me, [sel [i]]);
					}
				}
				//a.data.me.parseElement.apply (a.data.me, [$(this).children (":selected")]);
			}
		)
		var evcb = function (ev) { 
			return function (a) { 
				var mo = $(this).data () [ev];
				if (mo) { 
					var cb = function (ant) { 
						return function () { 
							ant.parseElement.apply (ant, [this]);	
						}
					}
					$(mo).each (cb (a.data.me));
				} else {
					var x = a.data.me;
					x.parseElement.apply (x, [this]);
				}
			}
		}
		$("[data-mouseover]").mouseover ({me: this}, evcb ("mouseover"))
		$("[data-mouseout]").mouseout ({me: this}, evcb ("mouseout"))
		$("[data-click]").click ({me: this}, evcb ("click"))
		$("[data-change]").change ({me: this}, evcb ("change"))

		var cb = function (me) { 
			return function (r) { 
				me.addMedia.apply (me, [$(this) [0]]); 
			}
		};
		$("[data-media]").each (cb (this));
	},
	initControl: function (node) {
		var data = $(node).data ();
		var evcb = function (ev) { 
			return function (a) { 
				var mo = $(this).data () [ev];
				if (mo) { 
					var cb = function (ant) { 
						return function () { 
							ant.parseElement.apply (ant, [this]);	
						}
					}
					$(mo).each (cb (a.data.me));
				} else {
					var x = a.data.me;
					x.parseElement.apply (x, [this]);
				}
			}
		}
		if (data.change !== undefined) { $(node).change ({me: this, data: data}, evcb ("change")); }
		if (data.mouseover !== undefined) { $(node).mouseover ({me: this, data: data}, evcb ("mouseover")); }
		if (data.mouseout !== undefined) { $(node).mouseout ({me: this, data: data}, evcb ("mouseout")); }
		if (data.click !== undefined) {  $(node).click ({me: this, data: data}, evcb ("click")); }
		if (node.tagName == "SELECT" && data.control !== "undefined") {
			$(node).change (
				{me: this, data: data},
				function (a) {
					var sel = this;
					for (var i = 0; i < sel.options.length; i++) {
						if (sel.options [i].selected) {
							a.data.me.parseElement.apply (a.data.me, [sel [i]]);
						}
					}
				}
			);
		}
	},
	addMedia: function (elm) { 
		var id = elm.id;
		var data = $(elm).data ();
		var type = data.media;
		var x, alt;
		switch (type) {
			case 'youtube': x = new Popcorn.HTMLYouTubeVideoElement( elm ); break
			case 'vimeo': x = new Popcorn.HTMLVimeoVideoElement( elm ); break;
			case 'video': 
				elm.preload = "auto";
				var alt = new VideoInLine (elm);
				if (window.makeVideoPlayableInline !== undefined) { window.makeVideoPlayableInline (elm); } 
				break;
			case 'audio': x = "#" + id; break;
			case 'timer': alt = new Timefy (data.timer_args); break;
		}
		if (x) { 
			x.src = $(elm).data ("media_url");
			var media = new Popcorn (x);
		} else if (alt) {
			var media = alt; 
		}
		media.load ();
		var cb = function (context, obj, elm) { 
			return function (e) { 
				var currentTime = obj.currentTime (), currentSecond = Math.floor (currentTime), millisecond = currentTime - currentSecond, currentMillisecond = Math.floor (millisecond * 10);
				var parseCb = function (me) { 
					return function () { 
						me.parseElement.apply (me, [$(this) [0]]);
					} 
				}
				if (obj.currentSecond != currentSecond) {
					var every = [1,2,3,4,5,10,15,20,30,40,45,50,55,60];	
					var trigg = [];
					for (var i in every) { 
						if (currentSecond % every [i] === 0) trigg.push (every [i]);
					}
					for (var i in trigg) {  
						$("[data-subscribe_media='" + elm.id + "'][data-subscribe_every='" + trigg [i] + "']").each (parseCb (context));
					}
					$("[data-subscribe_media='" + elm.id + "'][data-subscribe_time='" + currentSecond + "']").each (parseCb (context));
					obj.currentSecond = currentSecond;
				}
				$("[data-subscribe_media='" + elm.id + "'][data-subscribe_time='" + currentSecond + "." + currentMillisecond + "']").each (parseCb (context));
			}
		}
		var intervalCb = function (a, media, c, cb) { return function () { media.interval = setInterval.apply (null, [cb (a, media, elm), 100]); } }
		var removeIntervalCb = function (a,media,c) { return function () { if (media.interval) clearInterval.apply (null, [media.interval]); } }
		media.on ("play", intervalCb (this, media, elm, cb));
		media.on ("pause", removeIntervalCb (this,media,elm));
		media.play (); media.pause ();
		//media.on ("timeupdate", cb (this, media, elm));
		//TODO subscribers for play, stop, etc.

		this.medium [id] = media;
	},
	chartType: function (chartName) {
		return this.chartTypes [chartName];
	},
	initChart: function (element) { 
		var id = $(element).attr ('id');
		//if (!this.charts [id]) {
			var data = $(element).data ();
			var dChart = data.chart;
			this.chartTypes [id] = dChart; 
			var obj;
			if (dChart == "map") {
				obj  = new ant.charts.map ("#" + id, $(element).width (), $(element).height ());
			//	obj.setCenter ({lat: data.map_center_lat, lon: data.map_center_lon});
				// TODO fix this following lines: the layers should be drawn by the quantifier.
				if (data.map_layers) { 
					var layers = data.map_layers.split (',');
					for (var a in layers) {
						var l = this.conf.data [layers [a]];
						var plot = l.plot ? l.plot : "lines";
						var topo = obj.addFeatures (l.id, this.data [l.id], l.key); 
						// TODO FIX THIS.. it is needed for when using points layers.
						topo.redraw (this.setFeatureId (l), null, plot)
					}
				}
				this.charts [id] = obj;
				//this.charts [id].on ("click", function (a, id, x, el) { this.parseElement (el); }, this); 
				//this.charts [id].on ("mouseover", function (a, id, x, el) { this.parseElement (el); }, this); 
				this.parseElement ("#" + id);
			}
			if (dChart == "bars" || dChart == "lines" || dChart == "pie" || dChart == "treemap" || dChart == "sunburst" || dChart == "force") { 
				obj  = new ant.charts [dChart] (id, $(this).data ())	
				this.charts [id] = obj;
				this.parseElement ("#" + id);
			}
		//} else {
		//	console.log ("Chart already exists: " + id);
		//}
	},
	initCharts: function () {
		var m = this;
		$("[data-chart]").each (function (e) { m.initChart.apply (m, [$(this)]); });
	},
	initSlides: function () { 
		var slides = {};
		$("[data-slide]").each (function (i) { 
			var slide = $(this).data ("slide"); 
			if (!slides [slide]) slides [slide] = {};
			var id = $(this).attr ('id');
			slides [slide][id] = $(this) [0]; 
		});
		for (var c in slides) {
			var controller = new ScrollMagic.Controller ({
				globalSceneOptions: {
					triggerHook: 'onLeave'
				}
			});
			var scenes = {}
			for (var p in slides [c]) {
				var panel = slides [c] [p];
				var scene = new ScrollMagic.Scene ({ 
					triggerElement: panel
				})
				.setPin (panel)
				.addTo (controller);
				var cb = function (me) { return function (e) { me.parseElement.apply (me, [e.target.triggerElement ()]); } };
				scene.on ("enter", cb (this));
				var lv = function (me) { 
					return function (e) { 
						var d = $(e.target.triggerElement()).data ();
						if (d.slide_leave_parse !== undefined) { 
							var x = d.slide_leave_parse.split (',');
							for (a in x) { 
								me.parseElement.apply (me, ["#" + x [a]]);
							}
						}
					};
				};
				scene.on ("leave", lv (this));
				scenes [p] = scene;
			}
			this.slides [c] = {controller: controller, slides: scenes};
		}
	},
	initScroll: function () {
		var cb = function (me) { 
			return function () { 
				var id = $(this).attr ('id');
				var scroll = new Scenify ("#" + id);
				scroll.on ("scene_progress", $.proxy (me.scrollProgress, me));
				scroll.on ("scene_enter", $.proxy (me.scrollEnter, me));
				scroll.on ("scene_leave", $.proxy (me.scrollLeave, me));
				me.scroll [id] = scroll;
			};
		}
		$("[data-movie]").each (cb (this));
	}
};
function Timefy () { 
	this.init ();
	return this;
}
Timefy.prototype = {
	constructor: Timefy,
	_interval: null,
	_tic: -1,
	_paused: true,
	init: function () {
		this.paused (true);
		this._tic = -1;
		this._interval = null;
	},
	load: function () {},
	play: function () {
		this.paused (false);
		if (!this._interval) { 
			var cb = function (me) { return function () { if (!me.paused.apply (me)) {  me._tic+=100; me.callback.apply (me, ["timeupdate"]); } }} 
			this._interval = setInterval (cb (this), 100);	
		}
		this.callback ("play");
	},
	currentTime: function (tic) { if (tic !== undefined) { this._tic = tic; } return this._tic / 1000;},
	muted: function () {},
	pause: function () {  
		if (!this.paused ()) this.paused (true);
		this.callback ("pause");
	},
	paused: function (paused) { if (paused !== undefined) { this._paused = paused; } return this._paused },
	stop: function () {
		clearInterval (this._interval);
		this.callback ("pause");
		this.init ();
	},
	callbacks: {},
	on: function (ev, cb) {
		if (!this.callbacks [ev]) { this.callbacks [ev] = []; }
		this.callbacks [ev].push (cb);
	},
	callback: function (ev) { 
		if (!this.callbacks [ev]) return;
		for (cb in this.callbacks [ev]) {
			var x = this.callbacks [ev] [cb];
			if (x) x (); //TODO check scopes;
		}
	}
}
function VideoInLine (vid) { 
	this.init (vid);
	return this;
}
VideoInLine.prototype = {
	constructor: VideoInLine,
	_element: null,
	_tic: -1,
	init: function (vid) { 
		this.callbacks = {};
		this._element = vid;
	},
	load: function () { this._element.load (); },
	play: function () { 
		this._element.play ();
	},
	pause: function () { 
		this._element.pause ();
	},
	stop: function () { 
		this._element.pause ();
	},
	currentTime: function (tic) { if (tic !== undefined) { this._element.currentTime = tic; } return this._element.currentTime; },
	muted: function () { 
	},
	callbacks: {},
	on: function (ev, cb) { 
		//this._element.addEventListener (ev, function (me) { return function () { cb.apply (me, arguments); } } (this));
		this._element.addEventListener (ev, cb);
	},
	callback: function (ev) { 
		if (!this.callbacks [ev]) return;
		for (cb in this.callbacks [ev]) {
			var x = this.callbacks [ev] [cb];
			if (x) x ();
		}
	}
}
function Chart (container, conf) {
	this.init ();
	return this;
}
var asChart = function () {
	this.updateSize = function () { 
		this.svg.attrs ({"width": "100%", "height": "100%"})
		var rect = this.container.node ().getBoundingClientRect ();

		this.realSvg = this.svg;
		this.realWidth = rect.width; 
		this.realHeight = rect.height;
		this.svg = this.svg.append ("g")
			.attr ("transform", "translate(" + this.margin.left + "," + this.margin.top + ")")


		this.width = parseInt(rect.width)-parseInt(this.margin.left)-parseInt(this.margin.right);
		this.height = rect.height - this.margin.top - this.margin.bottom; 
	}
	this.quantifierCallback = function (quantifier, callback, innerCallback) {
		if (quantifier) {
			// this generates a callback that gives us the chance to edit every attribute in the chart element, and edit it with the users' values (class, degrees, x, y, etc).
			return function (selector, a, i, args) {  
				var qn = quantifier, attrs;
				if (Array.isArray(a)) { //no objects please, only arrays.
					var rets = [];
					// this is for a nested collection. It only supports the first two dimensions. AFAIK. 
					var fns = [];
					if (!i) { 
						for (var d in a) { 
							fns.push (a [d]);
						}
					} else {
						fns.push (a [i]);
					}
					for (var x in fns) { 
						var ret = qn.fn.apply (qn.context, [fns [x], qn.args, qn.data, args]); //calls the users' callback for every item. 
						if (innerCallback) { 
							ret = innerCallback.apply (this, [ret]); // calls charts' "inner" callback with users' input.
						}
						rets.push (ret);
					}
					attrs = callback.apply (this, [rets ]); // calls charts' normal callback with the collected return values from the inner callback;
				} else if (callback) {
					var ret = qn.fn.apply (qn.context, [a, qn.args, qn.data]);
					attrs = callback.apply (this, [ret]); 
				} else {
					attrs = qn.fn.apply (qn.context [a, qn.args, qn.data]);
				}
				this.setElementAttributes (selector, attrs);
			}
		}
		return function (selector, d) { d3.select (selector).attr ("class", ""); };
	}
	this.setElementAttributes = function (element, oattrs) {
		//var attrs =  jQuery.extend ({}, oattrs, true), data;
		var attrs = oattrs, data;
		if (attrs) { 
			if (attrs.height < 0) attrs.height = 0;
			if (attrs.data) {
				data = attrs.data;	
				attrs.data = null;
			}
			element.attrs (attrs);
		}
		if (data) { 
			for (var d in data) { 
				var val = data [d];
				if (val === Object (val)) { 
					val = JSON.stringify (val);
				}
				element.attr ("data-" + d, val);
			}
		}
	}
	this.init = function (container, conf) {
		this.conf = conf;
		this.container = d3.select ("#" + container);
		this.margin = conf.margin ? conf.margin : {top: 10, right: 20, bottom: 10, left: 20};
		this.svg = this.container.append ("svg");
		this.updateSize ();

		return this;
	}
	this.addClass = function (sel, cls) { 
		this.svg.selectAll (sel).classed (cls, true);
	}
	this.removeClass = function (sel, cls) { 
		this.svg.selectAll (sel).classed (cls, false);
	}
	this.createEmptyCallback = function (type) {
		return function () {
			d3.event.stopPropagation ();
		}
	}
	this.createCallback = function (type, cb) {
		var me = this;
		return function () {
			d3.event.stopPropagation ();
			var args = [];
			for (var a in arguments) {
				args.push (arguments [a]);
			}
			args.push (this);
			me.callback.apply (me, [type, args]);
			if (cb) { 
				cb.apply (me, arguments);
			}

		}
	}
	this.callbacks = {};
	this.on = function (ev, cb, scope) {
		if (!this.callbacks [ev]) {
			this.callbacks [ev] = [];
		}
		if (!scope) { scope = this; }
		this.callbacks [ev].push ({ scope: scope, callback: cb});	
	}
	this.removeCallback = function (ev, cb) {
		for (var x in this.callbacks [ev]) {
			if (this.callbacks [ev] [x].callback == cb) {
				this.callbacks [ev].splice (x, 1);
			}
		}
	}
	this.callback = function (ev, args) {
		if (!this.callbacks [ev]) return;
		for (cb in this.callbacks [ev]) {
			if (cb) { 
				var x = this.callbacks [ev][cb];	
				x.callback.apply (x.scope, args); 
			}
		}
	}
	return this;
}
var asBars = function () {
	this.redraw = function (d, quantifier) {
		this.callbacks = {};
		var data = d.data;
		d.scale.range ([0, this.height]);

		var barWidth = this.width / data.length;
		var chartHeight = this.height;
		var after = function (attrs) {
			var height = attrs === Number (attrs) ? attrs : attrs.height;
			if (isNaN (attrs.height)) attrs.height = 0;
			var calcY = chartHeight - attrs.height;
			if (isNaN (calcY)) calcY = 0;
			attrs.y = calcY;
			attrs.width = barWidth;

			return attrs;
		}
		var inner = function (ret) {  }
		var qn = this.quantifierCallback (quantifier, after, inner);  
		
		var margin = this.margin;
		this.svg.selectAll ("g").remove (); //HACK. Sucks. 
		var items = data;
		
		if (typeof data.items === "function") { 
			items = data.items ();
		}
		var bar = this.svg.selectAll ("g")
			.data (items);

		bar.enter ().append ("g")
			.attr ("transform", function (d, i) { return "translate(" + i * barWidth + ", " + margin.top + ")"; });	
		bar.append ("rect")
			.each (function (d, i) { qn (this, d, i); })
			.on ("click", this.createCallback ("click"))
			.on ("mouseover", this.createCallback ("mouseover"))
			.on ("mouseout", this.createCallback ("mouseout"))
			
	}
	return this;
}
ant.charts.bars = function (container, conf) { this.init (container, conf); }
asChart.call (ant.charts.bars.prototype);
asBars.call (ant.charts.bars.prototype);
var asLines = function () {
	this.redraw  = function (d, quantifier) { 
		if (!d || !d.scale || !d.data) throw "no data or scale. Scale should be added in the prequantifier";
		this.callbacks = {};
		var data = d.data;
	
		this.svg.selectAll ("g").remove (); //HACK lets see later how to UPDATE the elements instead of just removing all... 
		var yAxis, xAxis;
		if (d.scale && (d.scale.x || d.scale.y)) { 
			if (d.scale.x) {
				d.scale.x.range ([0, this.width]);
				xAxis = d3.axisBottom (d.scale.x).tickSize (this.height);
			}
			if (d.scale.y) {
				d.scale.y.range ([0, this.height]);
				yAxis = d3.axisLeft (d.scale.y).tickSize (this.width);
			}
		} else {
			d.scale.range ([0, this.height]); // this comes from the prequantifier and it is used by the quantifier 
			yAxis = d3.axisLeft (d.scale).tickSize (this.width);
		}

		if (xAxis) { 
			this.svg.append ("g").classed ("axis", true).call (xAxis). attr ("transform", "translate(0,0)");
		}
		this.svg.append ("g").classed ("axis", true).call (yAxis).attr ("transform", "translate("+ this.width  +",0)");
	
		var lines = data; //TODO verify if this works with a single line..
		if (data.nests == 2) {
			lines = data.items ();
		}
		var itemsMax = d3.max (lines, function (l) { return l.values.length; });
		var pointDistance = this.width / itemsMax;
		var height = this.height;

		var after = function (container, bgLayer, origAttrs) { 
			return function (rets, a) {
				var ys = [], rs = [], origYs = [];
				var bgCont = bgLayer.insert ("g").classed ("background", true);
				var colCont = container.insert ("g").classed ("column", true);
				var cirCont = container.insert ("g").classed ("circle", true);
				var linesCont = container.insert ("g").classed ("lines", true);
	
				for (var i in rets) {
					var origY = rets [i].y, origX = rets [i].x, bgX = pointDistance * i;
					rets [i].y = 0;
					rets [i].x = pointDistance * i;
					rets [i].width = pointDistance;
					rets [i].height = height; 

					var rect = bgCont.insert ("rect", ":first-child")
						.on ("click", this.createCallback ("click"))
						.on ("mouseover", this.createCallback ("mouseover"))
						.on ("mouseout", this.createEmptyCallback ("mouseout"));
					this.setElementAttributes (rect, {data: rets [i]["data"], width: pointDistance, height: height, x: bgX, y: 0, "class": rets [i]["class"]});

					rets [i].y = origY;
					rets [i].x = origX ? origX : rets [i].x;
					rets [i].cx = rets [i].x;
					rets [i].cy = rets [i].y;
					if (origAttrs && origAttrs.closed && i == 0) {
						ys.push ({y: height, x: rets [i].x});
					}
					if (origAttrs && origAttrs ["stepped"] == true) {
						ys.push ({y: rets [i].y, x: rets [i].x});
						ys.push ({y: rets [i].y, x: rets [i].x + pointDistance});
					} else {
						ys.push ({y: rets [i].y, x: rets [i].x});
					}
					rs.push (rets [i].r);

					//FOREGROUND

					var attrs = {
						y: rets [i].y, 
						x: rets [i].x, 
						width: pointDistance, 
						height: pointDistance, 
						data: rets [i].data,
						"class": rets [i]["class"]
					};
					var col = colCont.append ("rect")
						.on ("click", this.createCallback ("click"))
						.on ("mouseover", this.createCallback ("mouseover"))
						.on ("mouseout", this.createEmptyCallback ("mouseout"));
					attrs.height = height - attrs.y;
					this.setElementAttributes (col, attrs);
					col.classed ("column", true);

					var circle = cirCont.insert ("circle")
						.on ("click", this.createCallback ("click"))
						.on ("mouseover", this.createCallback ("mouseover"))
						.on ("mouseout", this.createEmptyCallback ("mouseout"));
					this.setElementAttributes (circle, {"class": rets [i]["class"], cx: rets [i].x, cy: rets [i].y, r: rets [i].r, data: rets [i].data});
					if (rets [i].value) {
						var text = container.append("text").text (rets [i].value);
						this.setElementAttributes (text, {"class": rets [i]["class"], x: rets [i].x, y: rets [i].y});
						text.classed ("value", true);
					}
					if (rets [i].label) {
						var text = container.append ("text").text (rets [i].label);
						this.setElementAttributes (text, {"class": rets [i]["class"], x: rets [i].x, y: height, "transform": "rotate(-90,"+ rets [i].x +","+ height +")"});
						text.classed ("label", true);
					}
					if (rets [i].note) {
						var text = container.append ("text").text (rets [i].note);
						this.setElementAttributes (text, {"class": rets [i]["class"], x: rets [i].x, y: 0});
						text.classed ("note", true);

					}
					// line between points
					if (i > 0) {
						var points = [rets [(i-1)], rets [i]];
						var dir = "eq";
						if (rets [i].y < rets [(i-1)].y) dir = "down"; else if (rets [i].y > rets [(i-1)].y) dir = "up"; 
						this.setElementAttributes (linesCont.append ("path").attr ("d", function (t) { return d3.line ().x (function (a) { return a.x; }).y (function (a) { return a.y; }) (points); }), {"class": rets [i]["class"] + " " + dir, data: rets [i].data});
					}
				}
				if (origAttrs && origAttrs.closed) {
					ys.push ({y: height, x: rets [i].x});
				}
				var x = function (d, e) { return d.x; };
				var y = function (d, e) { return d.y; };
				var line = container.insert ("path");
				line.classed ("line", true);
				var svgLine = d3.line ().x (x).y (y);
				line.attr ("d", function (t) { return svgLine (ys) })
					.on ("mouseover", this.createCallback ("mouseover"))
					.on ("mouseout", this.createEmptyCallback ("mouseout"))
					.on ("click", this.createCallback ("click"));
				this.setElementAttributes (line, origAttrs);
			} 
		}; 

		var quantifierCb = this.quantifierCallback, me = this; 
		

		var bgCont = this.svg.append ("g").classed ("backgrounds", true);
		for (var i in lines) { 
			var line = lines [i];
			var bar = this.svg.append ("g")
				.on ("click", this.createCallback ("click"))
				.on ("mouseover", this.createCallback ("mouseover"))
				.on ("mouseout", this.createEmptyCallback ("mouseout"));
			var qn = quantifierCb.apply (this, [quantifier, after (bar, bgCont, line.attrs)]); 
			qn.apply  (this, [bar, line.values, null, line]);  
			if (line.attrs) {
				this.setElementAttributes (bar, {"class": line.attrs ["class"], "id": line.attrs ["id"]});
			}
		}
	}
	return this;
}
ant.charts.lines = function (container, conf) { this.init (container,conf); }
asChart.call (ant.charts.lines.prototype);
asLines.call (ant.charts.lines.prototype);
//TODO refactor this.. :)
ant.charts.map = function (container, width, height) {
	this.scale = 1;
	this.translate = [width / 2, height / 2];
	this.refCenter = [.5, .5];
	this.translate = [width * this.refCenter [0], height * this.refCenter [1]]; 
	this.center = {lat: 34.5133, lon: -94.1629};
	this.width = width;
	this.height = height;
	this.container = container;
	this.topology = {};
	this.features = {};
	this.rateById = d3.map ();
	this.svg = d3.select (container).append ("svg").attr ("width", width).attr ("height", height); 
	this.topologies = {};
	this.projection = d3.geoMercator ();
	this.redraw = function (topo, quantifier, plot) {
		if (!topo) {
			for (t in this.topologies) {
				this.redraw (t, quantifier, plot);
			}
			return;
		}
		this.topologies[topo].redraw (quantifier, plot);
	}
	this.setScaleAndCenter = function (s, c) {
		this.scale = s;
		this.center = c;
		this.redraw ();
	}
	this.setScale = function (s) {
		this.scale = s;
		this.redraw ();
	}
	this.setCenter = function (c) {
		this.center = c;
		this.redraw ();
	}
	this.getPath = function () {
		if (!this.center) throw "No center defined";
		//TODO accomodate the lack of center coordinate.
		this.projection
			.scale(this.scale)
			.rotate ([-this.center.lon, 0])
			.center ([0, this.center.lat])
			.translate (this.translate);

		return d3.geoPath ().projection (this.projection);
	}
	this.zoomSelector = null,
	this.zoomContext = 20,
	this.reZoom = function () {
		if (this.zoomSelector != null) {
			this.zoomTo (this.zoomSelector, this.zoomContext);
		}
	},
	this.removeClass = function (selector, cls) { 
		this.svg.selectAll (selector).classed (cls, false);
	},
	this.addClass = function (selector, cls) { 
		this.svg.selectAll (selector).classed (cls, true);
	}
	this.zoomTo = function (selector, context) {
		if (!context) context = this.zoomContext 
		var e = this.svg.selectAll (selector);
		if (!e) throw "No element found: " + selector;
		this.zoomSelector = selector;
		this.zoomContext = context;
		var path = this.getPath ();
		var width = this.width;
		var height = this.height;
		var bounds = [], dx = [], dy = [], x = [], y = [];
		var bleft = [], bright = [], btop = [], bbottom = [];
		var dat = e.data ();
		for (var i in dat) { 
			var data = dat [i];
			var bn = path.bounds (data);
			bounds.push (bn);
			bleft.push (bn [0] [0]);
			btop.push (bn [0] [1]);
			bright.push (bn [1] [0]);
			bbottom.push (bn [1] [1]);
		}
		var minLeft = Math.min.apply (null, bleft), maxRight = Math.max.apply (null, bright), 
			minTop = Math.min.apply (null, btop), maxBottom = Math.max.apply (null, bbottom),
			height = maxBottom - minTop, width = maxRight - minLeft; 

		this.svg.attrs ({"viewBox": minLeft + " " + minTop + " " + width + " " + height});

	}
	this.addElement = function (tag, attrs) {
		var element = this.svg.append (tag); 
		element
			.on ("click", this.createCallback ("click"))
			.on ("mouseover", this.createCallback ("mouseover"));
		var data = attrs.data;
		attrs.data = null;
		element.attrs (attrs);
		if (data) { 
			for (var d in data) { 
				var val = data [d];
				if (val === Object (val)) { 
					val = JSON.stringify (val);
				}
				element.attr ("data-" + d, val);
			}
		}
	}
	this.addFeatures = function (topo, collection, key, quantifier, plot) {
		if (!plot) plot = "lines"
		if (this.topologies [topo]) throw "A topology " + topo + " already exists.";
		if (collection && collection.objects) {
			var features = collection.objects [key];
			if (features) {
				this.svg.append ("g")
					.attr ("class", topo);
				this.topologies [topo] = new ant.charts.map.topology (this, topo, collection, features);
				this.redraw (topo, quantifier, plot);

				return this.topologies [topo];
			} else {
				throw "No Features found: (" + topo + ")" + key;
			}
		} else {
			throw "Empty features collections? " + topo;
		}
	}
	/*
	* Duplicated code. TODO: refactor this:
	* TODO: Fix inheritance
	* TODO: refactor code
	*/
	this.createCallback = function (type) {
		var me = this;
		return function () {
			var args = [];
			for (var a in arguments) {
				args.push (arguments [a]);
			}
			args.push (this);
			me.callback.apply (me, [type, args]);
		}
	}
	this.callbacks = {};
	this.on = function (ev, cb, scope) {
		if (!this.callbacks [ev]) {
			this.callbacks [ev] = [];
		}
		if (!scope) { scope = this; }
		this.callbacks [ev].push ({ scope: scope, callback: cb});	
	}
	this.removeCallback = function (ev, cb) {
		for (var x in this.callbacks [ev]) {
			if (this.callbacks [ev] [x].callback == cb) {
				this.callbacks [ev].splice (x, 1);
			}
		}
	}
	this.callback = function (ev, args) {
		if (!this.callbacks [ev]) return;
		for (cb in this.callbacks [ev]) {
			if (cb) { 
				var x = this.callbacks [ev][cb];	
				x.callback.apply (x.scope, args); 
			}
		}
	}
	return this;
};
ant.charts.map.topology = function (map,name, t, f) {
	this.plot = "lines";
	this.parentMap = map;
	this.name = name;
	this.topology = t;
	this.features = f;
	this.redraw = function (setId, quantifier, plot) {
		this.callbacks = {};
		if (!plot) plot = "lines";
		this.plot = plot;
		this.parentMap.svg.select ("g." + this.name).selectAll ("text").remove ();
		var path = this.parentMap.getPath ();
		var parentSvg = this.parentMap.svg;
		
		var qn = quantifier ? $.proxy (
				function (selector, d, plot) {  
					var attrs = quantifier.fn.apply (quantifier.context, [d, quantifier.args, quantifier.data])
					if (!attrs) attrs = {};
					if (plot == "points") { 
						attrs.cx = path.centroid (d) [0];
						attrs.cy = path.centroid (d) [1];
					}
					if (attrs.text) {
						//TODO add <text> to centroid.
					}
					// This section adds the data-* attributes returned from the quantifier to the element...!!! 
					// This allows the cascading of visualizations
					var data = attrs.data;
					attrs.data = null;
					attrs ["vector-effect"] = "non-scaling-stroke";
					selector.attrs (attrs);
					if (data) { 
						for (var d in data) { 
							var val = data [d];
							if (val === Object (val)) { 
								val = JSON.stringify (val);
							}
							selector.attr ("data-" + d, val);
						}
					}
				},
			quantifier) : function (selector, d) { };

		if (plot == "lines") {
			this.parentMap.svg.select ("g." + this.name).selectAll ("path")
				.data (topojson.feature (this.topology, this.features).features)
				.each (function (d) { qn (d3.select (this), d, plot); })
				.attr ("id", setId)
				.attr ("d", function (x) { return path (x); })
				.enter ()
				.append ("path")
				.on ("click", this.createCallback ("click"))
				.on ("mouseover", this.createCallback ("mouseover"))
				.on ("mouseout", this.createCallback ("mouseout"))
		}
		if (plot == "points") {
			this.parentMap.svg.select ("g." + this.name).selectAll ("circle")
				.data (topojson.feature (this.topology, this.features).features)
				.each (function (d) { qn (d3.select (this), d, plot); }) 
				.attr ("id", setId)
				.enter ()
				.append ("circle")
				.on ("click", this.createCallback ("click"))
				.on ("mouseover", this.createCallback ("mouseover"))
				.on ("mouseout", this.createCallback ("mouseout"))
		}
	}
	this.createCallback = function (type) {
		var me = this;
		return function () {
			var args = [];
			for (var a in arguments) {
				args.push (arguments [a]);
			}
			args.push (this);
			me.callback.apply (me, [type, args]);
		}
	}
	this.callbacks = {};
	this.on = function (ev, cb, scope) {
		if (!this.callbacks [ev]) {
			this.callbacks [ev] = [];
		}
		if (!scope) { scope = this; }
		this.callbacks [ev].push ({ scope: scope, callback: cb});	
	}
	this.removeCallback = function (ev, cb) {
		for (var x in this.callbacks [ev]) {
			if (this.callbacks [ev] [x].callback == cb) {
				this.callbacks [ev].splice (x, 1);
			}
		}
	}
	this.callback = function (ev, args) {
		if (!this.callbacks [ev]) return;
		for (cb in this.callbacks [ev]) {
			if (cb) { 
				var x = this.callbacks [ev][cb];	
				x.callback.apply (x.scope, args); 
			}
		}
	}
}
var asPie = function () {
	this.redraw = function (d, quantifier) { 
		var data = d.data;
		d.scale.range ([0, 365]);
		var cb = this.quantifierCallback (quantifier, function () { console.log (arguments); });

		var g = this.svg.selectAll(".arc")
			.data(data.items ())
			.enter().append("g")
			.each (function (d, e) {  cb (this, d.key, d.values, e); })
			.attr("class", "arc");

	}
	return this;
}
ant.charts.pie = function (container, conf) { this.init (container, conf); }
asChart.call (ant.charts.pie.prototype);
asPie.call (ant.charts.pie.prototype);
var asSunburst = function () {
	this.redraw = function (d, quantifier) {
		if (!d || !d.scale || !d.data) throw "no data, scale defined. they should be returned from the prequantifier {scale: d3.scaleLinear (), data: [...], children: function (a) { }, sum: function (a) { }}"; 

		var radius = Math.min(this.width, this.height) / 2;

		var xScale = d3.scaleLinear()
		    .range([0, 2 * Math.PI]);

		var yScale = d3.scaleLinear ()
		    .range([0, radius]);

		var partition = d3.partition();

		var arc = d3.arc()
			.startAngle (function(d) { return Math.max (0, Math.min (2 * Math.PI, xScale (d.x0))); })
			.endAngle (function(d) { return Math.max (0, Math.min (2 * Math.PI, xScale (d.x1))); })
			.innerRadius (function(d) { return Math.max (0, yScale (d.y0)); })
			.outerRadius (function(d) { return Math.max (0, yScale (d.y1)); });


		var attrsFn = function (me, qn, tween) { 
			return function (dx, e, xx) { 
				var elm = d3.select (xx [e]); // a "g" element
				var ret = qn.fn.apply (qn.context, [dx, qn.data, e, xx]);
				if (!ret) ret = {};

				var a = arc (dx);
				var path = elm.append ("path").attr ("d", a);
				me.setElementAttributes (elm, ret); 
				me.setElementAttributes (path, ret); 

				if (ret.label !== undefined) {
					var angle = (xScale (dx.x0 + (dx.x1 - dx.x0) / 2) - Math.PI / 2) / Math.PI * 180, 
					translate = yScale (dx.y0 + (dx.y1 - dx.y0) / 2);

					elm.classed ("hidelabel", (xScale (dx.x1 - dx.x0) < 0.03));

					// calculate the brightness of the fill color to determine if the label's own color should be brighter or darker
					var labelCls = "";
					if (ret.fill !== undefined) {
						var c = d3.color (ret.fill).rgb ();
						// ((Red value X 299) + (Green value X 587) + (Blue value X 114)) / 1000

						var idx = ((c.r * 299) + (c.g * 587) + (c.b * 114)) / 1000;
						labelCls = d3.scaleQuantize ().domain ([0, 255]).range (["brighter", "darker"])(idx) + " "+idx;
					}


					elm.append ("svg:text")
						.classed (labelCls, true)
						
						.attr ("transform", "rotate(" + angle + ")translate("+ translate +")rotate("+(angle > 90 ? 180 : 0)+")")
						.attr ("fill-rule", "evenodd")
						.selectAll ("tspan")
						.data (ret.label.split (" ").filter (function (x, i, m) { return x.length >= 3 || m.length == 1}))
						.enter ().append ("tspan")
							.text (function (word, x) { return word; })
							.attr ("x", 0)
							.attr ("text-anchor", "middle")
							.attr ("y", function (w, i) { return i + "em" })
				}
			}
		};
		
		partition (d.data)
		var clickFn = function (me, quantifier) {
			return function (d) { 
				if (!d.children) return;
				//var mFn = function (a) { if (a.data.key !== undefined) { return a.data.key; } },
				var mFn = function (a) { return a;  },
					//key = d.data.key,
					key = d,
					ancestors = d.ancestors ().map (mFn),
					par = d.parent;

				var lblTween = function (elm) {  
					return function (dx) {
						return function () {
							var angle = (xScale (dx.x0 + (dx.x1 - dx.x0) / 2) - Math.PI / 2) / Math.PI * 180, 
							translate = yScale (dx.y0 + (dx.y1 - dx.y0) / 2)

							//d3.select (elm)
							//	.classed ("hidelabel", (xScale (dx.x1 - dx.x0) < 0.03))

							return "rotate(" + angle + ")translate("+ translate +")rotate("+(angle > 90 ? 180 : 0)+")";

						}
					};
				}
				me.svg
					.transition ()
					.duration (2550)
					.selectAll ("g")
					.each (function (xd, xi, xe) { 
						var vis = true;
						if (xd) { 
							//vis = (xd.parent == par ||  ancestors.indexOf (xd.data.key) !== -1 || xd.ancestors ().map (mFn).indexOf (key) !== -1)
							vis = (!xd.parent ||ancestors.indexOf (xd) !== -1 || xd.ancestors ().map (mFn).indexOf (key) !== -1)
						}
						d3.select (this).style ("visibility", (vis ? "visible" : "hidden"));
						if (!vis) return;

						var tweenFn = function () {
							var xd = d3.interpolate(xScale.domain (), [d.x0, d.x1]),
							yd = d3.interpolate(yScale.domain (), [d.y0, 1]),
							yr = d3.interpolate(yScale.range (), [d.y0 ? 20 : 0, radius]);
							return function(t) { xScale.domain (xd(t)); yScale.domain (yd(t)).range (yr(t)); };
						}
						d3.select (this)
							.selectAll ("path")
							.transition ()
							.tween ("scale", tweenFn) 
							.attrTween ("d", function (d)  { return function () { return arc (d); } } ) 

						d3.select (this)
							.selectAll ("text")
							.transition ()
							.tween ("scale", tweenFn) 
							.attrTween ("transform", lblTween (this))
					});
			}
			
		}

		this.svg.append ("g")
			.attr ('transform', 'translate(' + this.width/2 + ',' + this.height/2 + ')')
			.selectAll ("path")
			.data (d.data.descendants ())
			.enter ().append ("g")
				.on ("click", this.createCallback ("click", clickFn (this, quantifier)))
				.on ("mouseover", this.createCallback ("mouseover"))
				.on ("mouseout", this.createEmptyCallback ("mouseout"))
				.each (attrsFn (this, quantifier))
	}
	return this;
}
ant.charts.sunburst = function (container, conf) { this.init (container,conf); }
asChart.call (ant.charts.sunburst.prototype);
asSunburst.call (ant.charts.sunburst.prototype);
var asTreemap = function () {
	this.redraw = function (d, quantifier) {
	}
	return this;
}
ant.charts.treemap = function (container, conf) { this.init (container,conf); }
asChart.call (ant.charts.treemap.prototype);
asTreemap.call (ant.charts.treemap.prototype);
function Scenify (selector) {
	this.selector = selector;
	this.controller = new ScrollMagic.Controller ({addIndicators: false});
	this.controller.scrollTo (function (newpos) {
		window.scrollTo (0, newpos + 2);
	});
	this.callbacks = {
		scene: { progress: [], enter: [], leave: [] }
	};
	this.scenes = {};
	this.highlightedElements = {};
	this.init ();
	return this;
}
//TODO Refactor and paramaterize this... 
Scenify.prototype = {
	constructor: Scenify,
	init: function () {
		var data = $(this.selector).data ();
		var defaultPosition = data.trigger_position ? data.trigger_position : 0.15;
		$(this.selector).children ().each ($.proxy (function (index, child) {
			var sceneElement = $(child);
			var sceneData = sceneElement.data ();
			var hook = sceneData.trigger_position ? sceneData.trigger_position : defaultPosition;
			var scene = new ScrollMagic.Scene ({triggerElement: child, tweenChanges: true, duration: sceneElement.height ()})
					.triggerHook (hook)
					//.addIndicators ()
					.addTo (this.controller);
			$(sceneElement).addClass ("scene");

			scene.on ("enter", $.proxy (this.enterCallback, this));
			scene.on ("leave", $.proxy (this.leaveCallback, this));
			scene.on ("progress", $.proxy (this.progressCallback, this));
			this.scenes [sceneElement.attr ('id')] = scene;

		}, this));
		return this;
	},
	scrollTo: function (sel) { 
		this.controller.scrollTo (this.scenes [sel]);
		this.trigger ("enter", this.scenes [sel]); //TODO Verify why I used enter and not scene_enter here... 
	},
	/*
	* Scroll to next and prev require the scenes to have id, otherwise it wont work
	* TODO: make it work without requiring id
	*/
	scrollToNext: function () { 
		var next = $(this.currentScene.triggerElement ()).next ()
		this.scrollTo (next.attr ('id'));
	},
	scrollToPrev: function () { 
		var prev = $(this.currentScene.triggerElement ()).prev ()
		this.scrollTo (prev.attr ('id'));
	},
	progressCallback: function (ev) { 
		if (ev.type == "progress") {
			var elm = ev.target.triggerElement ();
			this.trigger ("scene_progress", [elm, ev.progress]);
		}
	},
	enterCallback: function (ev) { 
		var elm = ev.target.triggerElement ();
		this.currentScene = ev.target;
		this.trigger ("scene_enter", [elm]);
	},
	leaveCallback: function (ev) {
		var elm = ev.target.triggerElement ();
		this.trigger ("scene_leave", [elm]);
	},
	trigger: function (eventName, args) {
		for (c in this.callbacks [eventName]) {
			var cb = this.callbacks [eventName] [c];
			cb.apply (this, args);
		}
	},
	on: function (eventName, callback) {
		if (!this.callbacks [eventName]) this.callbacks [eventName] = [];
		this.callbacks [eventName].push (callback);
		return this;
	}
};
function Nestify (data, keys, rollup, aggregator, interiorKey) {
	this.nest = this._nest (keys, rollup, aggregator, interiorKey)
	this.data = this.init (data, this.nest, aggregator, interiorKey);
	this.asHierarchy = function (sum, sort) {
		return d3.hierarchy ({values: this.nest.entries (data)}, function(d) { return d.values; })
			.sum (sum)
			.sort (sort)
	}
	return this;
}
Nestify.prototype = {
	constructor: Nestify,
	_nest: function (keys, rollup, aggregator, interiorKey) {
		var n = d3.nest ();
		if (keys) {
			for (x in keys) {
				var cb = function (k) { 
					return function (r) { if (interiorKey) { return interiorKey; } return r [k] }; 
				}
				n = n.key (cb (keys [x]));
			}
		}
		n = n.rollup (
			function (r) { 
				var obj = {}; 
				for (d in rollup) { 
					if (!aggregator) { 
						for (i in r) { 
							obj [rollup [d]] = r [i] [rollup [d]];
						}
					} else { 
						if (!obj [rollup [d]]) obj [rollup [d]] = [];
						for (i in r) {
							obj [rollup [d]].push (r [i] [rollup [d]]);
						}
						obj [rollup [d]] = aggregator (obj [rollup [d]], rollup [d])

						if (!obj [rollup [d]]) obj [rollup [d]] = r [i] [rollup [d]];
						/*
						var cb = function (col, intK) { 
							return function (a) { if (intK) { return  parseInt (a [intK]); } return parseInt (a [col]); }
						}
						if (interiorKey !== undefined) { 
							obj.value = aggregator (r, cb (rollup [d], interiorKey));
						} else {
							obj [rollup [d]] = aggregator (r, cb (rollup [d], interiorKey));
						}
						*/
					}

				} 
				return obj; 
			}
		);

		return n;
	},
	init: function (data, nest, aggregator, interiorKey) {
		var n = nest.object (data);
		var summarize = function (leaf, key) {
			if (leaf) {
				var length = 0;
				var hasChildren = false;
				for (var k in leaf) { 
					if (leaf [k] === Object(leaf [k])) {
						var x = summarize (leaf [k], k);
						length ++;
						hasChildren = true;
					} else if (Array.isArray (leaf)) {
						length = leaf.length;
						//IMPORTANT: leaf [k] NEEDS to be an object so it can be used with values () and items (), etc. This is key.
						var col;
						if (interiorKey !== undefined) { 
							col = leaf [interiorKey];
							leaf = {};
						} else {
							col = leaf [k];
							leaf [col] = {};
						}
						hasChildren = false;
					} else {
						//LEAF at this point is key:value... where should we set it up?
						if (interiorKey !== undefined) {
							val = leaf [k] [interiorKey];
							leaf = {value: val}
						} else {
							var val = leaf [k];
							leaf [k] = {value: val}
						}

					}
				}
				/*	if (!key) {
					leaf.nests = keys.length 
				}*/
				leaf.values = function () { var ks = []; for (var k in this) {if (this [k] === Object (this [k]) && typeof this [k] != "function") { ks.push (this [k]);} } return ks; }
				//TODO add keyName, this way we can match it to key == "2010" and keyName == "year" 
				leaf.items = function () { var ks = [];  for (var k in this) { if (this [k] === Object (this [k]) && typeof this [k] != "function") { ks.push ({key: k, values: this [k]}); } } return ks; }
				leaf.max = function (accessor) { return d3.max (this.items (), accessor); } 
				leaf.min = function (accessor) { return d3.min (this.items (), accessor); } 
				leaf.mean = function (accessor) { return d3.mean (this.items (), accessor); } 
				leaf.sum = function (accessor) { return d3.sum (this.items (), accessor); }
				leaf.extent = function (accessor) { return d3.extent (this.items (), accessor); } 
				leaf.minsum = function (accessor) { var t = this.items (); return [d3.min (t, accessor), d3.sum (t, accessor)]}
				leaf.minmean = function (accessor) { var t = this.items (); return [d3.min (t, accessor), d3.mean (t, accessor)]}
				leaf.meanmax = function (accessor) { var t = this.items (); return [d3.mean (t, accessor), d3.max (t, accessor)]}
				leaf.sortBy = function (s) { var t = this.items (); return t.sort (function (a, b) { return a.values [k] < b.values [k]; }) }
				leaf.length = length;
				leaf.hasChildren = hasChildren;
				return leaf;
			}
		}
		n = summarize (n);

		return n;
	}
}
