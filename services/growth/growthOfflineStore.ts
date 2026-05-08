import type { GrowthRecord, GrowthRecordInput } from "@/services/api/growth";
import { getLocalDb, runLocalDbWrite } from "@/services/local/sqlite";

export type GrowthSyncStatus = "synced" | "pending" | "failed";

export type LocalGrowthRecord = GrowthRecord & {
	syncError?: string | null;
	syncStatus?: GrowthSyncStatus;
};

export type QueuedGrowthMutation = {
	babyId: string;
	error?: string | null;
	growthId?: string | null;
	id: string;
	localId?: string | null;
	operation: "create" | "update" | "delete";
	payload: GrowthRecordInput;
	status: "pending" | "failed";
	userId: string;
};

type GrowthRecordRow = {
	error: string | null;
	record_json: string;
	sync_status: GrowthSyncStatus;
};

type GrowthMutationRow = {
	baby_id: string;
	error: string | null;
	growth_id: string | null;
	id: string;
	local_id: string | null;
	operation: QueuedGrowthMutation["operation"];
	payload_json: string;
	status: QueuedGrowthMutation["status"];
	user_id: string;
};

export async function loadCachedGrowthRecords(userId: string, babyId: string) {
	const db = await getLocalDb();
	const rows = await db.getAllAsync<GrowthRecordRow>(
		`
		SELECT record_json, sync_status, error
		FROM growth_record_cache
		WHERE user_id = ? AND baby_id = ? AND deleted_at IS NULL
		ORDER BY measured_date DESC
		`,
		[userId, babyId],
	);

	return rows.map((row) => ({
		...(JSON.parse(row.record_json) as GrowthRecord),
		syncError: row.error,
		syncStatus: row.sync_status,
	}));
}

export async function upsertLocalGrowthRecord({
	babyId,
	error = null,
	record,
	syncStatus,
	userId,
}: {
	babyId: string;
	error?: string | null;
	record: GrowthRecord;
	syncStatus: GrowthSyncStatus;
	userId: string;
}) {
	await runLocalDbWrite(async () => {
		const db = await getLocalDb();
		await db.runAsync(
			`
			INSERT INTO growth_record_cache (
				user_id, baby_id, id, measured_date, record_json, sync_status, deleted_at, error, updated_at
			)
			VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)
			ON CONFLICT(user_id, baby_id, id) DO UPDATE SET
				measured_date = excluded.measured_date,
				record_json = excluded.record_json,
				sync_status = excluded.sync_status,
				deleted_at = NULL,
				error = excluded.error,
				updated_at = excluded.updated_at
			`,
			[
				userId,
				babyId,
				record.id,
				record.measuredDate,
				JSON.stringify(record),
				syncStatus,
				error,
				record.updatedAt,
			],
		);
	});
}

export async function markGrowthRecordDeleted({
	babyId,
	growthId,
	userId,
}: {
	babyId: string;
	growthId: string;
	userId: string;
}) {
	const now = new Date().toISOString();

	await runLocalDbWrite(async () => {
		const db = await getLocalDb();
		await db.runAsync(
			`
			UPDATE growth_record_cache
			SET deleted_at = ?, sync_status = 'pending', updated_at = ?
			WHERE user_id = ? AND baby_id = ? AND id = ?
			`,
			[now, now, userId, babyId, growthId],
		);
	});
}

export async function removeGrowthRecordCache({
	babyId,
	growthId,
	userId,
}: {
	babyId: string;
	growthId: string;
	userId: string;
}) {
	await runLocalDbWrite(async () => {
		const db = await getLocalDb();
		await db.runAsync(
			"DELETE FROM growth_record_cache WHERE user_id = ? AND baby_id = ? AND id = ?",
			[userId, babyId, growthId],
		);
	});
}

export async function replaceLocalGrowthId({
	babyId,
	localId,
	record,
	userId,
}: {
	babyId: string;
	localId: string;
	record: GrowthRecord;
	userId: string;
}) {
	await runLocalDbWrite(async () => {
		const db = await getLocalDb();
		await db.withExclusiveTransactionAsync(async (tx) => {
			await tx.runAsync(
				"DELETE FROM growth_record_cache WHERE user_id = ? AND baby_id = ? AND id = ?",
				[userId, babyId, localId],
			);
			await tx.runAsync(
				`
				INSERT INTO growth_record_cache (
					user_id, baby_id, id, measured_date, record_json, sync_status, deleted_at, error, updated_at
				)
				VALUES (?, ?, ?, ?, ?, 'synced', NULL, NULL, ?)
				ON CONFLICT(user_id, baby_id, id) DO UPDATE SET
					measured_date = excluded.measured_date,
					record_json = excluded.record_json,
					sync_status = 'synced',
					deleted_at = NULL,
					error = NULL,
					updated_at = excluded.updated_at
				`,
				[
					userId,
					babyId,
					record.id,
					record.measuredDate,
					JSON.stringify(record),
					record.updatedAt,
				],
			);
		});
	});
}

export async function mergeServerGrowthRecords({
	babyId,
	records,
	userId,
}: {
	babyId: string;
	records: GrowthRecord[];
	userId: string;
}) {
	const now = new Date().toISOString();

	await runLocalDbWrite(async () => {
		const db = await getLocalDb();
		await db.withExclusiveTransactionAsync(async (tx) => {
			const pendingRows = await tx.getAllAsync<{ growth_id: string | null; local_id: string | null }>(
				`
				SELECT growth_id, local_id
				FROM growth_mutation_queue
				WHERE user_id = ? AND baby_id = ? AND status IN ('pending', 'failed')
				`,
				[userId, babyId],
			);
			const pendingIds = new Set(
				pendingRows.flatMap((row) => [row.growth_id, row.local_id]).filter(Boolean) as string[],
			);
			const serverIds = new Set(records.map((record) => record.id));

			for (const record of records) {
				if (pendingIds.has(record.id)) {
					continue;
				}

				await tx.runAsync(
					`
					INSERT INTO growth_record_cache (
						user_id, baby_id, id, measured_date, record_json, sync_status, deleted_at, error, updated_at
					)
					VALUES (?, ?, ?, ?, ?, 'synced', NULL, NULL, ?)
					ON CONFLICT(user_id, baby_id, id) DO UPDATE SET
						measured_date = excluded.measured_date,
						record_json = CASE
							WHEN growth_record_cache.sync_status = 'synced'
								AND growth_record_cache.updated_at <= excluded.updated_at
							THEN excluded.record_json
							ELSE growth_record_cache.record_json
						END,
						sync_status = CASE
							WHEN growth_record_cache.sync_status = 'synced'
							THEN 'synced'
							ELSE growth_record_cache.sync_status
						END,
						deleted_at = CASE
							WHEN growth_record_cache.sync_status = 'synced'
							THEN NULL
							ELSE growth_record_cache.deleted_at
						END,
						error = CASE
							WHEN growth_record_cache.sync_status = 'synced'
							THEN NULL
							ELSE growth_record_cache.error
						END,
						updated_at = CASE
							WHEN growth_record_cache.sync_status = 'synced'
								AND growth_record_cache.updated_at <= excluded.updated_at
							THEN excluded.updated_at
							ELSE growth_record_cache.updated_at
						END
					`,
					[
						userId,
						babyId,
						record.id,
						record.measuredDate,
						JSON.stringify(record),
						record.updatedAt,
					],
				);
			}

			const syncedRows = await tx.getAllAsync<{ id: string }>(
				`
				SELECT id
				FROM growth_record_cache
				WHERE user_id = ? AND baby_id = ? AND sync_status = 'synced'
				`,
				[userId, babyId],
			);

			for (const row of syncedRows) {
				if (!serverIds.has(row.id)) {
					await tx.runAsync(
						`
						UPDATE growth_record_cache
						SET deleted_at = ?, updated_at = ?
						WHERE user_id = ? AND baby_id = ? AND id = ?
						`,
						[now, now, userId, babyId, row.id],
					);
				}
			}
		});
	});
}

export async function enqueueGrowthMutation(mutation: QueuedGrowthMutation) {
	const now = new Date().toISOString();

	await runLocalDbWrite(async () => {
		const db = await getLocalDb();
		await db.runAsync(
			`
			INSERT INTO growth_mutation_queue (
				id, user_id, baby_id, operation, growth_id, local_id, payload_json, status, error, created_at, updated_at
			)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`,
			[
				mutation.id,
				mutation.userId,
				mutation.babyId,
				mutation.operation,
				mutation.growthId ?? null,
				mutation.localId ?? null,
				JSON.stringify(mutation.payload),
				mutation.status,
				mutation.error ?? null,
				now,
				now,
			],
		);
	});
}

export async function loadPendingGrowthMutations(userId: string, babyId: string) {
	const db = await getLocalDb();
	const rows = await db.getAllAsync<GrowthMutationRow>(
		`
		SELECT id, user_id, baby_id, operation, growth_id, local_id, payload_json, status, error
		FROM growth_mutation_queue
		WHERE user_id = ? AND baby_id = ? AND status = 'pending'
		ORDER BY created_at ASC
		`,
		[userId, babyId],
	);

	return rows.map((row) => ({
		babyId: row.baby_id,
		error: row.error,
		growthId: row.growth_id,
		id: row.id,
		localId: row.local_id,
		operation: row.operation,
		payload: JSON.parse(row.payload_json) as GrowthRecordInput,
		status: row.status,
		userId: row.user_id,
	}));
}

export async function markGrowthMutationSynced(id: string) {
	await runLocalDbWrite(async () => {
		const db = await getLocalDb();
		await db.runAsync("DELETE FROM growth_mutation_queue WHERE id = ?", [id]);
	});
}

export async function markGrowthMutationFailed(id: string, error: string) {
	const now = new Date().toISOString();

	await runLocalDbWrite(async () => {
		const db = await getLocalDb();
		await db.runAsync(
			`
			UPDATE growth_mutation_queue
			SET status = 'failed', error = ?, retry_count = retry_count + 1, updated_at = ?
			WHERE id = ?
			`,
			[error, now, id],
		);
	});
}

export async function updateQueuedGrowthCreateByLocalId({
	babyId,
	localId,
	payload,
	userId,
}: {
	babyId: string;
	localId: string;
	payload: GrowthRecordInput;
	userId: string;
}) {
	const now = new Date().toISOString();

	await runLocalDbWrite(async () => {
		const db = await getLocalDb();
		await db.runAsync(
			`
			UPDATE growth_mutation_queue
			SET payload_json = ?, updated_at = ?
			WHERE user_id = ? AND baby_id = ? AND local_id = ? AND operation = 'create'
			`,
			[JSON.stringify(payload), now, userId, babyId, localId],
		);
	});
}

export async function deleteQueuedGrowthCreateByLocalId({
	babyId,
	localId,
	userId,
}: {
	babyId: string;
	localId: string;
	userId: string;
}) {
	await runLocalDbWrite(async () => {
		const db = await getLocalDb();
		await db.runAsync(
			`
			DELETE FROM growth_mutation_queue
			WHERE user_id = ? AND baby_id = ? AND local_id = ? AND operation = 'create'
			`,
			[userId, babyId, localId],
		);
	});
}
