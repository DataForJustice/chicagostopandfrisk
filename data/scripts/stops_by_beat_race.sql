COPY (SELECT
	beat,
	firstporace,
	count (*) as total,
	count (*) filter (WHERE subrace = 'WHITE') as white,
	count (*) filter (WHERE subrace = 'BLACK') as black,
	count (*) filter (WHERE subrace = 'HISPANIC') as hispanic,
	count (*) filter (WHERE subrace != 'WHITE' AND subrace != 'BLACK' AND subrace != 'HISPANIC') as other
FROM
	stops
WHERE
	"contact date" != ''
GROUP BY
	beat,
	firstporace
ORDER BY
	beat
) TO '/tmp/stops_by_beat_race.csv' CSV HEADER;
