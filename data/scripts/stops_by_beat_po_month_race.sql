COPY (SELECT
	to_char ("contact date"::timestamp, 'YYYYMM') as month,
	beat,
	firstpoln,
	firstpofn,
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
	to_char ("contact date"::timestamp, 'YYYYMM'),
	beat,
	firstpoln,
	firstpofn,
	firstporace
) TO '/tmp/stops_by_beat_po_month_race.csv' CSV HEADER;
