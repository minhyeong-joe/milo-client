import type { RoutineDay } from "@/data/homeData";
import { getLocalDb, runLocalDbWrite } from "@/services/local/sqlite";
import type {
	CreateRoutineLogInput,
	RoutineLastLogged,
	UpdateRoutineLogInput,
} from "@/services/api/routine";
import type { RoutineKind } from "@/data/homeData";

export type QueuedRoutineMutation = {
	babyId: string;
	clientMutationId?: string;
	error?: string | null;
	eventId?: string;
	id: string;
	kind: RoutineKind;
	localId?: string;
	operation: "create" | "update" | "delete";
	payload: CreateRoutineLogInput | UpdateRoutineLogInput | Record<string, never>;
	status: "pending" | "failed";
	userId: string;
};

type RoutineDayCacheRow = {
	day_json: string;
};

type RoutineMetaCacheRow = {
	last_logged_json: string | null;
	next_start_date: string | null;
};

type RoutineMutationQueueRow = {
	baby_id: string;
	client_mutation_id: string | null;
	error: string | null;
	event_id: string | null;
	id: string;
	kind: RoutineKind;
	local_id: string | null;
	operation: "create" | "update" | "delete";
	payload_json: string;
	status: "pending" | "failed";
	user_id: string;
};

export async function loadCachedRoutineHome(userId: string, babyId: string) {
	const db = await getLocalDb();
	const [dayRows, metaRow] = await Promise.all([
		db.getAllAsync<RoutineDayCacheRow>(
			`
			SELECT day_json
			FROM routine_day_cache
			WHERE user_id = ? AND baby_id = ?
			ORDER BY date DESC
			`,
			[userId, babyId],
		),
		db.getFirstAsync<RoutineMetaCacheRow>(
			`
			SELECT last_logged_json, next_start_date
			FROM routine_meta_cache
			WHERE user_id = ? AND baby_id = ?
			`,
			[userId, babyId],
		),
	]);

	return {
		dailyLogs: dayRows.flatMap((row) => parseJson<RoutineDay>(row.day_json)),
		lastLogged: metaRow?.last_logged_json
			? parseJson<RoutineLastLogged>(metaRow.last_logged_json)[0] ?? null
			: null,
		nextStartDate: metaRow?.next_start_date ?? null,
	};
}

export async function saveRoutineHomeCache({
	babyId,
	dailyLogs,
	lastLogged,
	nextStartDate,
	userId,
}: {
	babyId: string;
	dailyLogs: RoutineDay[];
	lastLogged: RoutineLastLogged | null;
	nextStartDate?: string | null;
	userId: string;
}) {
	return runLocalDbWrite(async () => {
		const db = await getLocalDb();
		const now = new Date().toISOString();
		const shouldUpdateNextStartDate = nextStartDate !== undefined;

		await db.withExclusiveTransactionAsync(async (tx) => {
			for (const day of dailyLogs) {
				if (day.timeline.length === 0) {
					await tx.runAsync(
					"DELETE FROM routine_day_cache WHERE user_id = ? AND baby_id = ? AND date = ?",
					[userId, babyId, day.date],
				);
					continue;
				}

				await tx.runAsync(
					`
					INSERT INTO routine_day_cache (user_id, baby_id, date, day_json, updated_at)
					VALUES (?, ?, ?, ?, ?)
					ON CONFLICT(user_id, baby_id, date) DO UPDATE SET
						day_json = excluded.day_json,
						updated_at = excluded.updated_at
					`,
					[userId, babyId, day.date, JSON.stringify(day), now],
				);
			}

			await tx.runAsync(
				`
				INSERT INTO routine_meta_cache (
					user_id,
					baby_id,
					last_logged_json,
					next_start_date,
					updated_at
				)
				VALUES (?, ?, ?, ?, ?)
				ON CONFLICT(user_id, baby_id) DO UPDATE SET
					last_logged_json = excluded.last_logged_json,
					next_start_date = CASE
						WHEN ? THEN excluded.next_start_date
						ELSE routine_meta_cache.next_start_date
					END,
					updated_at = excluded.updated_at
				`,
				[
					userId,
					babyId,
					lastLogged ? JSON.stringify(lastLogged) : null,
					nextStartDate ?? null,
					now,
					shouldUpdateNextStartDate ? 1 : 0,
				],
			);
		});
	});
}

export async function deleteRoutineDayCache(userId: string, babyId: string, date: string) {
	return runLocalDbWrite(async () => {
		const db = await getLocalDb();
		await db.runAsync(
			"DELETE FROM routine_day_cache WHERE user_id = ? AND baby_id = ? AND date = ?",
			[userId, babyId, date],
		);
	});
}

export async function enqueueRoutineMutation(mutation: QueuedRoutineMutation) {
	return runLocalDbWrite(async () => {
		const db = await getLocalDb();
		const now = new Date().toISOString();

		await db.runAsync(
			`
			INSERT INTO routine_mutation_queue (
				id,
				user_id,
				baby_id,
				operation,
				kind,
				event_id,
				local_id,
				client_mutation_id,
				payload_json,
				status,
				error,
				created_at,
				updated_at
			)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(id) DO UPDATE SET
				payload_json = excluded.payload_json,
				status = excluded.status,
				error = excluded.error,
				updated_at = excluded.updated_at
			`,
			[
				mutation.id,
				mutation.userId,
				mutation.babyId,
				mutation.operation,
				mutation.kind,
				mutation.eventId ?? null,
				mutation.localId ?? null,
				mutation.clientMutationId ?? null,
				JSON.stringify(mutation.payload),
				mutation.status,
				mutation.error ?? null,
				now,
				now,
			],
		);
	});
}

export async function loadPendingRoutineMutations(userId: string, babyId: string) {
	const db = await getLocalDb();
	const rows = await db.getAllAsync<RoutineMutationQueueRow>(
		`
		SELECT *
		FROM routine_mutation_queue
		WHERE user_id = ? AND baby_id = ? AND status = 'pending'
		ORDER BY created_at ASC
		`,
		[userId, babyId],
	);

	return rows.flatMap(parseQueuedMutation);
}

export async function markRoutineMutationSynced(id: string) {
	return runLocalDbWrite(async () => {
		const db = await getLocalDb();
		await db.runAsync("DELETE FROM routine_mutation_queue WHERE id = ?", [id]);
	});
}

export async function markRoutineMutationFailed(id: string, error: string) {
	return runLocalDbWrite(async () => {
		const db = await getLocalDb();
		await db.runAsync(
			`
			UPDATE routine_mutation_queue
			SET status = 'failed', error = ?, updated_at = ?
			WHERE id = ?
			`,
			[error, new Date().toISOString(), id],
		);
	});
}

export async function updateQueuedCreatePayloadByLocalId(
	userId: string,
	babyId: string,
	localId: string,
	payload: CreateRoutineLogInput,
) {
	return runLocalDbWrite(async () => {
		const db = await getLocalDb();
		await db.runAsync(
			`
			UPDATE routine_mutation_queue
			SET payload_json = ?, client_mutation_id = ?, updated_at = ?
			WHERE user_id = ?
				AND baby_id = ?
				AND local_id = ?
				AND operation = 'create'
				AND status = 'pending'
			`,
			[
				JSON.stringify(payload),
				payload.clientMutationId ?? null,
				new Date().toISOString(),
				userId,
				babyId,
				localId,
			],
		);
	});
}

export async function deleteQueuedCreateByLocalId(
	userId: string,
	babyId: string,
	localId: string,
) {
	return runLocalDbWrite(async () => {
		const db = await getLocalDb();
		await db.runAsync(
			`
			DELETE FROM routine_mutation_queue
			WHERE user_id = ?
				AND baby_id = ?
				AND local_id = ?
				AND operation = 'create'
				AND status = 'pending'
			`,
			[userId, babyId, localId],
		);
	});
}

function parseQueuedMutation(row: RoutineMutationQueueRow) {
	const payload = parseJson<QueuedRoutineMutation["payload"]>(row.payload_json)[0];

	if (!payload) {
		return [];
	}

	return [{
		babyId: row.baby_id,
		clientMutationId: row.client_mutation_id ?? undefined,
		error: row.error,
		eventId: row.event_id ?? undefined,
		id: row.id,
		kind: row.kind,
		localId: row.local_id ?? undefined,
		operation: row.operation,
		payload,
		status: row.status,
		userId: row.user_id,
	} satisfies QueuedRoutineMutation];
}

function parseJson<T>(value: string) {
	try {
		return [JSON.parse(value) as T];
	} catch {
		return [];
	}
}
