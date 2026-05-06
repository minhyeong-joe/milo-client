import type { BabyListItem } from "@/services/api/babies";
import { getLocalDb, runLocalDbWrite } from "@/services/local/sqlite";

type BabyCacheRow = {
	babies_json: string;
	selected_baby_id: string | null;
};

export async function loadCachedBabySelection(userId: string) {
	const db = await getLocalDb();
	const row = await db.getFirstAsync<BabyCacheRow>(
		"SELECT babies_json, selected_baby_id FROM baby_cache WHERE user_id = ?",
		[userId],
	);

	if (!row) {
		return null;
	}

	try {
		return {
			babies: JSON.parse(row.babies_json) as BabyListItem[],
			selectedBabyId: row.selected_baby_id,
		};
	} catch {
		return null;
	}
}

export async function saveCachedBabySelection(
	userId: string,
	babies: BabyListItem[],
	selectedBabyId: string | null,
) {
	return runLocalDbWrite(async () => {
		const db = await getLocalDb();

		await db.runAsync(
			`
			INSERT INTO baby_cache (user_id, babies_json, selected_baby_id, updated_at)
			VALUES (?, ?, ?, ?)
			ON CONFLICT(user_id) DO UPDATE SET
				babies_json = excluded.babies_json,
				selected_baby_id = excluded.selected_baby_id,
				updated_at = excluded.updated_at
			`,
			[userId, JSON.stringify(babies), selectedBabyId, new Date().toISOString()],
		);
	});
}
