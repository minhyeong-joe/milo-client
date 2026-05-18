import type {
	BabyImmunizationRecord,
	ImmunizationRecordInput,
	ImmunizationScheduleItem,
	ImmunizationScheduleProfile,
} from "@/services/api/immunizations";
import { getLocalDb, runLocalDbWrite } from "@/services/local/sqlite";

export type ImmunizationSyncStatus = "synced" | "pending" | "failed";

export type LocalImmunizationRecord = BabyImmunizationRecord & {
	syncError?: string | null;
	syncStatus?: ImmunizationSyncStatus;
};

export type CachedImmunizationPayload = {
	records: LocalImmunizationRecord[];
	scheduleItems: ImmunizationScheduleItem[];
	scheduleProfile: ImmunizationScheduleProfile;
};

export type QueuedImmunizationMutation = {
	babyId: string;
	error?: string | null;
	id: string;
	localId?: string | null;
	operation: "create" | "update" | "delete" | "profile";
	payload: ImmunizationRecordInput | { scheduleProfile: ImmunizationScheduleProfile };
	recordId?: string | null;
	status: "pending" | "failed";
	userId: string;
};

type PayloadRow = {
	schedule_items_json: string;
	schedule_profile: ImmunizationScheduleProfile;
};

type RecordRow = {
	error: string | null;
	record_json: string;
	sync_status: ImmunizationSyncStatus;
};

type MutationRow = {
	baby_id: string;
	error: string | null;
	id: string;
	local_id: string | null;
	operation: QueuedImmunizationMutation["operation"];
	payload_json: string;
	record_id: string | null;
	status: QueuedImmunizationMutation["status"];
	user_id: string;
};

export async function loadCachedImmunizations(userId: string, babyId: string) {
	const db = await getLocalDb();
	const payload = await db.getFirstAsync<PayloadRow>(
		`
		SELECT schedule_profile, schedule_items_json
		FROM immunization_payload_cache
		WHERE user_id = ? AND baby_id = ?
		`,
		[userId, babyId],
	);
	const rows = await db.getAllAsync<RecordRow>(
		`
		SELECT record_json, sync_status, error
		FROM immunization_record_cache
		WHERE user_id = ? AND baby_id = ? AND deleted_at IS NULL
		ORDER BY given_date DESC
		`,
		[userId, babyId],
	);

	return {
		records: rows.map((row) => ({
			...(JSON.parse(row.record_json) as BabyImmunizationRecord),
			syncError: row.error,
			syncStatus: row.sync_status,
		})),
		scheduleItems: payload ? JSON.parse(payload.schedule_items_json) as ImmunizationScheduleItem[] : [],
		scheduleProfile: payload?.schedule_profile ?? "US_CDC",
	} satisfies CachedImmunizationPayload;
}

export async function saveImmunizationPayload({
	babyId,
	scheduleItems,
	scheduleProfile,
	userId,
}: {
	babyId: string;
	scheduleItems: ImmunizationScheduleItem[];
	scheduleProfile: ImmunizationScheduleProfile;
	userId: string;
}) {
	const now = new Date().toISOString();
	await runLocalDbWrite(async () => {
		const db = await getLocalDb();
		await db.runAsync(
			`
			INSERT INTO immunization_payload_cache (
				user_id, baby_id, schedule_profile, schedule_items_json, updated_at
			)
			VALUES (?, ?, ?, ?, ?)
			ON CONFLICT(user_id, baby_id) DO UPDATE SET
				schedule_profile = excluded.schedule_profile,
				schedule_items_json = excluded.schedule_items_json,
				updated_at = excluded.updated_at
			`,
			[userId, babyId, scheduleProfile, JSON.stringify(scheduleItems), now],
		);
	});
}

export async function upsertLocalImmunizationRecord({
	babyId,
	error = null,
	record,
	syncStatus,
	userId,
}: {
	babyId: string;
	error?: string | null;
	record: BabyImmunizationRecord;
	syncStatus: ImmunizationSyncStatus;
	userId: string;
}) {
	await runLocalDbWrite(async () => {
		const db = await getLocalDb();
		await db.runAsync(
			`
			INSERT INTO immunization_record_cache (
				user_id, baby_id, id, given_date, record_json, sync_status, deleted_at, error, updated_at
			)
			VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)
			ON CONFLICT(user_id, baby_id, id) DO UPDATE SET
				given_date = excluded.given_date,
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
				record.givenDate,
				JSON.stringify(record),
				syncStatus,
				error,
				record.updatedAt,
			],
		);
	});
}

export async function mergeServerImmunizationRecords({
	babyId,
	records,
	userId,
}: {
	babyId: string;
	records: BabyImmunizationRecord[];
	userId: string;
}) {
	const now = new Date().toISOString();
	await runLocalDbWrite(async () => {
		const db = await getLocalDb();
		await db.withExclusiveTransactionAsync(async (tx) => {
			const pendingRows = await tx.getAllAsync<{ record_id: string | null; local_id: string | null }>(
				`
				SELECT record_id, local_id
				FROM immunization_mutation_queue
				WHERE user_id = ? AND baby_id = ? AND status IN ('pending', 'failed')
				`,
				[userId, babyId],
			);
			const pendingIds = new Set(
				pendingRows.flatMap((row) => [row.record_id, row.local_id]).filter(Boolean) as string[],
			);
			const serverIds = new Set(records.map((record) => record.id));

			for (const record of records) {
				if (pendingIds.has(record.id)) continue;

				await tx.runAsync(
					`
					INSERT INTO immunization_record_cache (
						user_id, baby_id, id, given_date, record_json, sync_status, deleted_at, error, updated_at
					)
					VALUES (?, ?, ?, ?, ?, 'synced', NULL, NULL, ?)
					ON CONFLICT(user_id, baby_id, id) DO UPDATE SET
						given_date = excluded.given_date,
						record_json = CASE
							WHEN immunization_record_cache.sync_status = 'synced'
								AND immunization_record_cache.updated_at <= excluded.updated_at
							THEN excluded.record_json
							ELSE immunization_record_cache.record_json
						END,
						sync_status = CASE
							WHEN immunization_record_cache.sync_status = 'synced'
							THEN 'synced'
							ELSE immunization_record_cache.sync_status
						END,
						deleted_at = CASE
							WHEN immunization_record_cache.sync_status = 'synced'
							THEN NULL
							ELSE immunization_record_cache.deleted_at
						END,
						error = CASE
							WHEN immunization_record_cache.sync_status = 'synced'
							THEN NULL
							ELSE immunization_record_cache.error
						END,
						updated_at = CASE
							WHEN immunization_record_cache.sync_status = 'synced'
								AND immunization_record_cache.updated_at <= excluded.updated_at
							THEN excluded.updated_at
							ELSE immunization_record_cache.updated_at
						END
					`,
					[
						userId,
						babyId,
						record.id,
						record.givenDate,
						JSON.stringify(record),
						record.updatedAt,
					],
				);
			}

			const syncedRows = await tx.getAllAsync<{ id: string }>(
				`
				SELECT id
				FROM immunization_record_cache
				WHERE user_id = ? AND baby_id = ? AND sync_status = 'synced'
				`,
				[userId, babyId],
			);

			for (const row of syncedRows) {
				if (!serverIds.has(row.id)) {
					await tx.runAsync(
						`
						UPDATE immunization_record_cache
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

export async function replaceLocalImmunizationId({
	babyId,
	localId,
	record,
	userId,
}: {
	babyId: string;
	localId: string;
	record: BabyImmunizationRecord;
	userId: string;
}) {
	await runLocalDbWrite(async () => {
		const db = await getLocalDb();
		await db.withExclusiveTransactionAsync(async (tx) => {
			await tx.runAsync(
				"DELETE FROM immunization_record_cache WHERE user_id = ? AND baby_id = ? AND id = ?",
				[userId, babyId, localId],
			);
			await tx.runAsync(
				`
				INSERT INTO immunization_record_cache (
					user_id, baby_id, id, given_date, record_json, sync_status, deleted_at, error, updated_at
				)
				VALUES (?, ?, ?, ?, ?, 'synced', NULL, NULL, ?)
				ON CONFLICT(user_id, baby_id, id) DO UPDATE SET
					given_date = excluded.given_date,
					record_json = excluded.record_json,
					sync_status = 'synced',
					deleted_at = NULL,
					error = NULL,
					updated_at = excluded.updated_at
				`,
				[userId, babyId, record.id, record.givenDate, JSON.stringify(record), record.updatedAt],
			);
		});
	});
}

export async function markImmunizationRecordDeleted({
	babyId,
	recordId,
	userId,
}: {
	babyId: string;
	recordId: string;
	userId: string;
}) {
	const now = new Date().toISOString();
	await runLocalDbWrite(async () => {
		const db = await getLocalDb();
		await db.runAsync(
			`
			UPDATE immunization_record_cache
			SET deleted_at = ?, sync_status = 'pending', updated_at = ?
			WHERE user_id = ? AND baby_id = ? AND id = ?
			`,
			[now, now, userId, babyId, recordId],
		);
	});
}

export async function removeImmunizationRecordCache({
	babyId,
	recordId,
	userId,
}: {
	babyId: string;
	recordId: string;
	userId: string;
}) {
	await runLocalDbWrite(async () => {
		const db = await getLocalDb();
		await db.runAsync(
			"DELETE FROM immunization_record_cache WHERE user_id = ? AND baby_id = ? AND id = ?",
			[userId, babyId, recordId],
		);
	});
}

export async function enqueueImmunizationMutation(mutation: QueuedImmunizationMutation) {
	const now = new Date().toISOString();
	await runLocalDbWrite(async () => {
		const db = await getLocalDb();
		await db.runAsync(
			`
			INSERT INTO immunization_mutation_queue (
				id, user_id, baby_id, operation, record_id, local_id, payload_json, status, error, created_at, updated_at
			)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`,
			[
				mutation.id,
				mutation.userId,
				mutation.babyId,
				mutation.operation,
				mutation.recordId ?? null,
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

export async function loadPendingImmunizationMutations(userId: string, babyId: string) {
	const db = await getLocalDb();
	const rows = await db.getAllAsync<MutationRow>(
		`
		SELECT id, user_id, baby_id, operation, record_id, local_id, payload_json, status, error
		FROM immunization_mutation_queue
		WHERE user_id = ? AND baby_id = ? AND status = 'pending'
		ORDER BY created_at ASC
		`,
		[userId, babyId],
	);

	return rows.map((row) => ({
		babyId: row.baby_id,
		error: row.error,
		id: row.id,
		localId: row.local_id,
		operation: row.operation,
		payload: JSON.parse(row.payload_json) as QueuedImmunizationMutation["payload"],
		recordId: row.record_id,
		status: row.status,
		userId: row.user_id,
	}));
}

export async function markImmunizationMutationSynced(id: string) {
	await runLocalDbWrite(async () => {
		const db = await getLocalDb();
		await db.runAsync("DELETE FROM immunization_mutation_queue WHERE id = ?", [id]);
	});
}

export async function markImmunizationMutationFailed(id: string, error: string) {
	const now = new Date().toISOString();
	await runLocalDbWrite(async () => {
		const db = await getLocalDb();
		await db.runAsync(
			`
			UPDATE immunization_mutation_queue
			SET status = 'failed', error = ?, retry_count = retry_count + 1, updated_at = ?
			WHERE id = ?
			`,
			[error, now, id],
		);
	});
}

export async function updateQueuedImmunizationCreateByLocalId({
	babyId,
	localId,
	payload,
	userId,
}: {
	babyId: string;
	localId: string;
	payload: ImmunizationRecordInput;
	userId: string;
}) {
	const now = new Date().toISOString();
	await runLocalDbWrite(async () => {
		const db = await getLocalDb();
		await db.runAsync(
			`
			UPDATE immunization_mutation_queue
			SET payload_json = ?, updated_at = ?
			WHERE user_id = ? AND baby_id = ? AND local_id = ? AND operation = 'create'
			`,
			[JSON.stringify(payload), now, userId, babyId, localId],
		);
	});
}

export async function deleteQueuedImmunizationCreateByLocalId({
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
			DELETE FROM immunization_mutation_queue
			WHERE user_id = ? AND baby_id = ? AND local_id = ? AND operation = 'create'
			`,
			[userId, babyId, localId],
		);
	});
}
