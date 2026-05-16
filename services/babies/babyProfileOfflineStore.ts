import type { BabyListItem, UpdateBabyRequest } from "@/services/api/babies";
import { updateBaby } from "@/services/api/babies";
import { getLocalDb, runLocalDbWrite } from "@/services/local/sqlite";

export type PendingBabyProfileMutation = {
	babyId: string;
	error?: string | null;
	payload: UpdateBabyRequest;
	status: "pending" | "failed";
	userId: string;
};

type BabyProfileMutationRow = {
	baby_id: string;
	error: string | null;
	payload_json: string;
	status: "pending" | "failed";
	user_id: string;
};

export async function enqueueBabyProfileMutation(mutation: PendingBabyProfileMutation) {
	const now = new Date().toISOString();

	return runLocalDbWrite(async () => {
		const db = await getLocalDb();
		await db.runAsync(
			`
			INSERT INTO baby_profile_mutation_queue (
				user_id, baby_id, payload_json, status, error, created_at, updated_at
			)
			VALUES (?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(user_id, baby_id) DO UPDATE SET
				payload_json = excluded.payload_json,
				status = excluded.status,
				error = excluded.error,
				updated_at = excluded.updated_at
			`,
			[
				mutation.userId,
				mutation.babyId,
				JSON.stringify(mutation.payload),
				mutation.status,
				mutation.error ?? null,
				now,
				now,
			],
		);
	});
}

export async function loadPendingBabyProfileMutations(userId: string) {
	const db = await getLocalDb();
	const rows = await db.getAllAsync<BabyProfileMutationRow>(
		`
		SELECT user_id, baby_id, payload_json, status, error
		FROM baby_profile_mutation_queue
		WHERE user_id = ? AND status IN ('pending', 'failed')
		ORDER BY updated_at ASC
		`,
		[userId],
	);

	return rows.flatMap(parseMutationRow);
}

export async function deleteBabyProfileMutation(userId: string, babyId: string) {
	return runLocalDbWrite(async () => {
		const db = await getLocalDb();
		await db.runAsync(
			"DELETE FROM baby_profile_mutation_queue WHERE user_id = ? AND baby_id = ?",
			[userId, babyId],
		);
	});
}

export async function markBabyProfileMutationFailed(
	userId: string,
	babyId: string,
	error: string,
) {
	return runLocalDbWrite(async () => {
		const db = await getLocalDb();
		await db.runAsync(
			`
			UPDATE baby_profile_mutation_queue
			SET status = 'failed', error = ?, updated_at = ?
			WHERE user_id = ? AND baby_id = ?
			`,
			[error, new Date().toISOString(), userId, babyId],
		);
	});
}

export async function applyPendingBabyProfileMutations(
	userId: string,
	babies: BabyListItem[],
) {
	const mutations = await loadPendingBabyProfileMutations(userId);

	if (mutations.length === 0) {
		return babies;
	}

	const mutationsByBabyId = new Map(mutations.map((mutation) => [mutation.babyId, mutation]));

	return babies.map((baby) => {
		const mutation = mutationsByBabyId.get(baby.id);

		if (!mutation) {
			return baby;
		}

		return {
			...baby,
			birthdate: mutation.payload.birthdate,
			name: mutation.payload.name,
			sex: mutation.payload.sex,
			updatedAt: new Date().toISOString(),
		};
	});
}

export async function syncPendingBabyProfileMutations(userId: string) {
	const mutations = await loadPendingBabyProfileMutations(userId);

	for (const mutation of mutations) {
		try {
			await updateBaby(mutation.babyId, mutation.payload);
			await deleteBabyProfileMutation(userId, mutation.babyId);
		} catch (error) {
			await markBabyProfileMutationFailed(userId, mutation.babyId, getErrorMessage(error));
			throw error;
		}
	}
}

function parseMutationRow(row: BabyProfileMutationRow) {
	try {
		return [{
			babyId: row.baby_id,
			error: row.error,
			payload: JSON.parse(row.payload_json) as UpdateBabyRequest,
			status: row.status,
			userId: row.user_id,
		} satisfies PendingBabyProfileMutation];
	} catch {
		return [];
	}
}

function getErrorMessage(error: unknown) {
	if (error instanceof Error) {
		return error.message;
	}

	return "Could not sync baby profile.";
}
