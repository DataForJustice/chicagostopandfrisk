-- run: psql -t -q -d chicago -f scripts/census.sql | topojson -q 1e3 -p -o blockgroups.json
SELECT
	row_to_json (c)
FROM
	(SELECT
		'FeatureCollection' as type,
		array_to_json (array_agg (b)) as features
	FROM
		(SELECT 
			'Feature' as type,
			ST_AsGeoJson (ST_Intersection (b.wkb_geometry, ch.city))::json as geometry,
			(WITH data (id, total, w, b, o, h, nh, a) AS (VALUES (id, total, w, b, o, h, nh, a)) SELECT row_to_json (data) FROM data) as properties
		FROM
			blockgroups b, 
			(SELECT
				id,
				total,
				white_nh as w,	
				black_nh + black_h as b,
				total_h as h,
				total_nh as nh,
				total - white_nh as a,
				white_h + 
					ai_an_nh + asian_nh + hawaiian_nh + other_nh + two_nh + 
					ai_an_h + asian_h + hawaiian_h + other_h + two_h  as o 
			FROM
				(SELECT
					"geo.id" as id,
					coalesce (nullif (hd01_vd01, ''), '0')::numeric as total,
					coalesce (nullif (hd01_vd02, ''), '0')::numeric as total_nh,
					coalesce (nullif (hd01_vd03, ''), '0')::numeric as white_nh,
					coalesce (nullif (hd01_vd04, ''), '0')::numeric as black_nh,
					coalesce (nullif (hd01_vd05, ''), '0')::numeric as ai_an_nh,
					coalesce (nullif (hd01_vd06, ''), '0')::numeric as asian_nh,
					coalesce (nullif (hd01_vd07, ''), '0')::numeric as hawaiian_nh,
					coalesce (nullif (hd01_vd08, ''), '0')::numeric as other_nh,
					coalesce (nullif (hd01_vd09, ''), '0')::numeric as two_nh,
					coalesce (nullif (hd01_vd12, ''), '0')::numeric as total_h,
					coalesce (nullif (hd01_vd13, ''), '0')::numeric as white_h,
					coalesce (nullif (hd01_vd14, ''), '0')::numeric as black_h,
					coalesce (nullif (hd01_vd15, ''), '0')::numeric as ai_an_h,
					coalesce (nullif (hd01_vd16, ''), '0')::numeric as asian_h,
					coalesce (nullif (hd01_vd17, ''), '0')::numeric as hawaiian_h,
					coalesce (nullif (hd01_vd18, ''), '0')::numeric as other_h,
					coalesce (nullif (hd01_vd19, ''), '0')::numeric as two_h
				FROM
					census_data h
				) a
			) a,
			(SELECT ST_Union (ST_SetSRID (wkb_geometry, 4326)) as city FROM beats) as ch
		WHERE
			b.geo_id = a.id
			AND ST_Intersects (ch.city, b.wkb_geometry)
		) as b
	) as c
