import type { RoutineStatsResponse } from "@/services/api/routine";
import { getLocalDb, runLocalDbWrite } from "@/services/local/sqlite";

type RoutineStatsCacheRow = {
	stats_json: string;
};

export async function loadCachedRoutineStats({
	babyId,
	endDate,
	startDate,
	userId,
}: {
	babyId: string;
	endDate: string;
	startDate: string;
	userId: string;
}) {
	const db = await getLocalDb();
	const row = await db.getFirstAsync<RoutineStatsCacheRow>(
		`
		SELECT stats_json
		FROM routine_stats_cache
		WHERE user_id = ? AND baby_id = ? AND start_date = ? AND end_date = ?
		`,
		[userId, babyId, startDate, endDate],
	);

	if (!row) {
		return null;
	}

	try {
		return JSON.parse(row.stats_json) as RoutineStatsResponse;
	} catch {
		return null;
	}
}

export async function saveRoutineStatsCache({
	babyId,
	stats,
	userId,
}: {
	babyId: string;
	stats: RoutineStatsResponse;
	userId: string;
}) {
	await runLocalDbWrite(async () => {
		const db = await getLocalDb();
		await db.runAsync(
			`
			INSERT INTO routine_stats_cache (
				user_id, baby_id, start_date, end_date, stats_json, updated_at
			)
			VALUES (?, ?, ?, ?, ?, ?)
			ON CONFLICT(user_id, baby_id, start_date, end_date) DO UPDATE SET
				stats_json = excluded.stats_json,
				updated_at = excluded.updated_at
			`,
			[
				userId,
				babyId,
				stats.startDate,
				stats.endDate,
				JSON.stringify(stats),
				new Date().toISOString(),
			],
		);
	});
}
