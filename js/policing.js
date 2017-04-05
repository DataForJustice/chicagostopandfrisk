$(document).ready (function () { 
	var cnf = {
		prequantifiers: {
			clear: function () { },
			stops: function (args) { 
				if (!args) args = {};
				var nests = args.nests ? args.nests : ["beat"], columns = args.columns ? args.columns : ["total"] ;
				var vals = [];
				var cb = function (v, col) { 
					if (columns.indexOf (col) !== -1) {
						var va = d3.sum (v);
						vals.push (va);
						return va;
					}
				}
				return {
					nest: new Nestify (this.data.stops, nests, columns, cb).data,
					scale: d3.scaleQuantize ().domain (d3.extent (vals)).range (["a", "b", "c", "d"])
				}
			}
		},
		quantifiers: {
			maps: {
				clear: function () { 
					return {"r": 0}
				},
				stops: function (beat, args, preq) { 
					//console.log (preq);
					if (!args) args = {};
					var nests = args.nests ? args.nests : ["beat"], columns = args.columns ? args.columns : ["total"] ;
					var obj = preq.nest;
					for (var x in nests) {
						obj = obj [beat.properties [nests [x]]]; 
					}	
					return { "class": "m_" + preq.scale (obj [columns [0]].value) };
				}
			}
		}
	};

	new Ant (cnf);
});
