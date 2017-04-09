$(document).ready (function () { 
	var cnf = {
		prequantifiers: {
			clear: function () { },
			stops: function (args) { 
				if (!args) args = {};
				if (!args.nestvalue) args.nestvalue = {};
				var nests = args.nests ? args.nests : ["beat"], column = args.column ? args.column : "total";
				var vals = [];
				var cb = function (v, col) { 
					return d3.sum (v);
				}

				var nest = new Nestify (this.data.stops, nests, this.data.stops.columns, cb).data;
				var extent = nest.extent (function (a) { 
					for (var i in nests) { 
						if (args.nestvalue [nests [i]]) {	
							a = a.values [args.nestvalue [nests [i]]];
						}
					}
					if (!a [column]) a = a.values;
					return parseInt (a [column].value); 
				});
				return {
					nest: nest,
					scale: d3.scaleQuantize ().domain (extent).range (["a", "b", "c", "d"])
				}
			}
		},
		quantifiers: {
			maps: {
				clear: function () { 
					return {"r": 0}
				},
				stops: function (beat, args, preq) { 
					if (!args) args = {};
					var nests = args.nests ? args.nests : ["beat"], column = args.column ? args.column : ["total"] ;
					var obj = preq.nest;
					var beatId = beat.properties [nests [0]];
					var beatObj = preq.nest [beatId]; // "beat" should always be the first pivot
					for (var x in nests) {
						var nestval = null;
						if (args.nestvalue) {
							nestval = args.nestvalue [nests [x]];
						}
						obj = obj [nestval ? nestval : beat.properties [nests [x]]]; 
					}
					var ks = ["BLACK", "HISPANIC", "WHITE"], cs = ["white", "black", "hispanic", "other"];
					if (obj) {
						var parse = [
							{"parse": "#show_legend,#clear_beats"},
							{"control_element": ".beat.beat_" + beatId, "element_add_class": "selected"}
						]

						for (var xk in ks) {
							for (var ck in cs) {
								if (beatObj [ks [xk]] && beatObj [ks [xk]] [cs [ck]]) {
									var className = ".legend." + ks [xk].toLowerCase () + "_on_" + cs [ck];
									var bOj = beatObj [ks [xk]] [cs [ck]];
									if (bOj.value) {
										parse.push ({"control_element": className, "element_show": true });
										parse.push ({"control_element": className + " .label", "element_text": bOj.value});
									}
								}
							}
						}
						parse.push ({control_element: ".beat_id", element_text: beatId});
						if (preq.nest [beatId].total) { 
							parse.push ({control_element: ".total_stops", element_text: preq.nest [beatId].total.value});
						} else {
							var total = preq.nest [beatId].sum (function (a) { return a.values.total.value; });
							parse.push ({"control_element": ".total_stops", "element_text": total});
						}
						var data = {
							"parse": parse
						};
						return { "class": "beat beat_" + beatId + " m_" + preq.scale (obj [column].value), "data": data};
					}
				}
			}
		}
	};

	new Ant (cnf);
});
