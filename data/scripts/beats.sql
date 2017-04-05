SELECT
	row_to_json (c)
FROM
	(SELECT
		'FeatureCollection' as type,
		array_to_json (array_agg (b)) as features
	FROM
		(SELECT
			'Feature' as type,
			ST_AsGeoJson (wkb_geometry)::json as geometry,
			(WITH data (distict, beat, sector) AS (VALUES (a.district, a.beat_num, a.sector, a.beat)) SELECT row_to_json (data) FROM data) as properties
		FROM
			beats a
		) as b
	) as c
