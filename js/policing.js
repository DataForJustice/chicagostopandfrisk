$(document).ready (function () { 
	var cnf = {
		prequantifiers: {
			clear: function () { },
			stops: function (args) { 
				if (!args) args = {};
				if (!args.nestvalue) args.nestvalue = {};
				var nests = args.nests ? args.nests : ["beat"], columns = args.columns ? args.columns : ["total"] ;
				var vals = [];
				var cb = function (v, col) { 
					if (columns.indexOf (col) !== -1) {
						return d3.sum (v);
					}
				}
				var nest = new Nestify (this.data.stops, nests, columns, cb).data;
				var extent = nest.extent (function (a) { 
					for (var i in nests) { 
						if (args.nestvalue [nests [i]]) {	
							a = a.values [args.nestvalue [nests [i]]];
						}
					}
					if (!a [columns [0]]) a = a.values;
					return parseInt (a [columns [0]].value); 
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
					var nests = args.nests ? args.nests : ["beat"], columns = args.columns ? args.columns : ["total"] ;
					var obj = preq.nest;
					for (var x in nests) {
						var nestval = null;
						if (args.nestvalue) {
							nestval = args.nestvalue [nests [x]];
						}
						obj = obj [nestval ? nestval : beat.properties [nests [x]]]; 
					}
					if (obj) {
						return { "class": "m_" + preq.scale (obj [columns [0]].value) };
					}
				}
			}
		}
	};

	new Ant (cnf);
});
