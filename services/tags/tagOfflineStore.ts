import type { DiaryTag } from "@/services/api/diary";
import { deleteTag, updateTag, type UpdateTagInput } from "@/services/api/tags";
import { getLocalDb, runLocalDbWrite } from "@/services/local/sqlite";

export type LocalTag = DiaryTag & {
	syncError?: string | null;
	syncStatus?: "synced" | "pending" | "failed";
};

export type QueuedTagMutation = {
	babyId: string;
	error?: string | null;
	id: string;
	operation: "update" | "delete";
	payload: UpdateTagInput | Record<string, never>;
	status: "pending" | "failed";
	tagId: string;
	userId: string;
};

type TagCacheRow = {
	error: string | null;
	sync_status: "synced" | "pending" | "failed";
	tag_json: string;
};

type TagMutationRow = {
	baby_id: string;
	error: string | null;
	id: string;
	operation: "update" | "delete";
	payload_json: string;
	status: "pending" | "failed";
	tag_id: string;
	user_id: string;
};

export async function loadCachedTags(userId: string, babyId: string) {
	const db = await getLocalDb();
	const rows = await db.getAllAsync<TagCacheRow>(
		`
		SELECT tag_json, sync_status, error
		FROM tag_cache
		WHERE user_id = ? AND baby_id = ? AND deleted_at IS NULL
		`,
		[userId, babyId],
	);

	return rows.flatMap((row) => {
		try {
			return [{
				...(JSON.parse(row.tag_json) as DiaryTag),
				syncError: row.error,
				syncStatus: row.sync_status,
			} satisfies LocalTag];
		} catch {
			return [];
		}
	}).sort(sortTags);
}

export async function saveTagsCache(userId: string, babyId: string, tags: DiaryTag[]) {
	const now = new Date().toISOString();

	return runLocalDbWrite(async () => {
		const db = await getLocalDb();
		await db.withExclusiveTransactionAsync(async (tx) => {
			for (const tag of tags) {
				await tx.runAsync(
					`
					INSERT INTO tag_cache (
						user_id, baby_id, id, tag_json, sync_status, deleted_at, error, updated_at
					)
					VALUES (?, ?, ?, ?, 'synced', NULL, NULL, ?)
					ON CONFLICT(user_id, baby_id, id) DO UPDATE SET
						tag_json = CASE
							WHEN tag_cache.sync_status = 'synced' THEN excluded.tag_json
							ELSE tag_cache.tag_json
						END,
						sync_status = CASE
							WHEN tag_cache.sync_status = 'synced' THEN 'synced'
							ELSE tag_cache.sync_status
						END,
						deleted_at = CASE
							WHEN tag_cache.sync_status = 'synced' THEN NULL
							ELSE tag_cache.deleted_at
						END,
						error = CASE
							WHEN tag_cache.sync_status = 'synced' THEN NULL
							ELSE tag_cache.error
						END,
						updated_at = excluded.updated_at
					`,
					[userId, babyId, tag.id, JSON.stringify(tag), now],
				);
			}
		});
	});
}

export async function upsertPendingTag(
	userId: string,
	babyId: string,
	tag: DiaryTag,
	error: string | null = null,
) {
	const now = new Date().toISOString();

	return runLocalDbWrite(async () => {
		const db = await getLocalDb();
		await db.runAsync(
			`
			INSERT INTO tag_cache (
				user_id, baby_id, id, tag_json, sync_status, deleted_at, error, updated_at
			)
			VALUES (?, ?, ?, ?, 'pending', NULL, ?, ?)
			ON CONFLICT(user_id, baby_id, id) DO UPDATE SET
				tag_json = excluded.tag_json,
				sync_status = 'pending',
				deleted_at = NULL,
				error = excluded.error,
				updated_at = excluded.updated_at
			`,
			[userId, babyId, tag.id, JSON.stringify(tag), error, now],
		);
	});
}

export async function markTagDeleted(userId: string, babyId: string, tagId: string) {
	const now = new Date().toISOString();

	return runLocalDbWrite(async () => {
		const db = await getLocalDb();
		await db.runAsync(
			`
			UPDATE tag_cache
			SET deleted_at = ?, sync_status = 'pending', updated_at = ?
			WHERE user_id = ? AND baby_id = ? AND id = ?
			`,
			[now, now, userId, babyId, tagId],
		);
	});
}

export async function enqueueTagMutation(mutation: QueuedTagMutation) {
	const now = new Date().toISOString();

	return runLocalDbWrite(async () => {
		const db = await getLocalDb();
		await db.runAsync(
			`
			INSERT INTO tag_mutation_queue (
				id, user_id, baby_id, tag_id, operation, payload_json, status, error, created_at, updated_at
			)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`,
			[
				mutation.id,
				mutation.userId,
				mutation.babyId,
				mutation.tagId,
				mutation.operation,
				JSON.stringify(mutation.payload),
				mutation.status,
				mutation.error ?? null,
				now,
				now,
			],
		);
	});
}

export async function loadPendingTagMutations(userId: string, babyId: string) {
	const db = await getLocalDb();
	const rows = await db.getAllAsync<TagMutationRow>(
		`
		SELECT id, user_id, baby_id, tag_id, operation, payload_json, status, error
		FROM tag_mutation_queue
		WHERE user_id = ? AND baby_id = ? AND status IN ('pending', 'failed')
		ORDER BY created_at ASC
		`,
		[userId, babyId],
	);

	return rows.flatMap(parseQueuedTagMutation);
}

export async function markTagMutationSynced(id: string) {
	return runLocalDbWrite(async () => {
		const db = await getLocalDb();
		await db.runAsync("DELETE FROM tag_mutation_queue WHERE id = ?", [id]);
	});
}

export async function markTagMutationFailed(id: string, error: string) {
	return runLocalDbWrite(async () => {
		const db = await getLocalDb();
		await db.runAsync(
			`
			UPDATE tag_mutation_queue
			SET status = 'failed', error = ?, updated_at = ?
			WHERE id = ?
			`,
			[error, new Date().toISOString(), id],
		);
	});
}

export async function removeTagCache(userId: string, babyId: string, tagId: string) {
	return runLocalDbWrite(async () => {
		const db = await getLocalDb();
		await db.runAsync(
			"DELETE FROM tag_cache WHERE user_id = ? AND baby_id = ? AND id = ?",
			[userId, babyId, tagId],
		);
	});
}

export async function syncPendingTagMutations(userId: string, babyId: string) {
	const mutations = await loadPendingTagMutations(userId, babyId);

	for (const mutation of mutations) {
		try {
			if (mutation.operation === "update") {
				const response = await updateTag(mutation.babyId, mutation.tagId, mutation.payload);
				await upsertSyncedTag(mutation.userId, mutation.babyId, response.tag);
			} else {
				await deleteTag(mutation.babyId, mutation.tagId);
				await removeTagCache(mutation.userId, mutation.babyId, mutation.tagId);
			}

			await markTagMutationSynced(mutation.id);
		} catch (error) {
			await markTagMutationFailed(mutation.id, getErrorMessage(error));
			throw error;
		}
	}
}

async function upsertSyncedTag(userId: string, babyId: string, tag: DiaryTag) {
	const now = new Date().toISOString();

	return runLocalDbWrite(async () => {
		const db = await getLocalDb();
		await db.runAsync(
			`
			INSERT INTO tag_cache (
				user_id, baby_id, id, tag_json, sync_status, deleted_at, error, updated_at
			)
			VALUES (?, ?, ?, ?, 'synced', NULL, NULL, ?)
			ON CONFLICT(user_id, baby_id, id) DO UPDATE SET
				tag_json = excluded.tag_json,
				sync_status = 'synced',
				deleted_at = NULL,
				error = NULL,
				updated_at = excluded.updated_at
			`,
			[userId, babyId, tag.id, JSON.stringify(tag), now],
		);
	});
}

function parseQueuedTagMutation(row: TagMutationRow) {
	try {
		return [{
			babyId: row.baby_id,
			error: row.error,
			id: row.id,
			operation: row.operation,
			payload: JSON.parse(row.payload_json) as QueuedTagMutation["payload"],
			status: row.status,
			tagId: row.tag_id,
			userId: row.user_id,
		} satisfies QueuedTagMutation];
	} catch {
		return [];
	}
}

function sortTags(left: DiaryTag, right: DiaryTag) {
	return left.name.localeCompare(right.name);
}

function getErrorMessage(error: unknown) {
	if (error instanceof Error) {
		return error.message;
	}

	return "Could not sync tag change.";
}
