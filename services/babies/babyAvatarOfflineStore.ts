import type { BabyListItem, CreateBabyAvatarUploadRequest } from "@/services/api/babies";
import {
	confirmBabyAvatar,
	createBabyAvatarUpload,
	removeBabyAvatar,
} from "@/services/api/babies";
import { getLocalDb, runLocalDbWrite } from "@/services/local/sqlite";
import {
	BABY_AVATAR_MAX_SIZE_BYTES,
	isBabyAvatarContentType,
} from "@/services/validation/inputLimits";

export type PendingBabyAvatarMutation = {
	babyId: string;
	contentType: CreateBabyAvatarUploadRequest["contentType"] | null;
	error?: string | null;
	localUri: string | null;
	operation: "replace" | "delete";
	status: "pending" | "failed";
	userId: string;
};

type BabyAvatarMutationRow = {
	baby_id: string;
	content_type: string | null;
	error: string | null;
	local_uri: string | null;
	operation: "replace" | "delete";
	status: "pending" | "failed";
	user_id: string;
};

export async function enqueueBabyAvatarMutation(mutation: PendingBabyAvatarMutation) {
	const now = new Date().toISOString();

	return runLocalDbWrite(async () => {
		const db = await getLocalDb();
		await db.runAsync(
			`
			INSERT INTO baby_avatar_mutation_queue (
				user_id, baby_id, operation, local_uri, content_type, status, error, created_at, updated_at
			)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(user_id, baby_id) DO UPDATE SET
				operation = excluded.operation,
				local_uri = excluded.local_uri,
				content_type = excluded.content_type,
				status = excluded.status,
				error = excluded.error,
				updated_at = excluded.updated_at
			`,
			[
				mutation.userId,
				mutation.babyId,
				mutation.operation,
				mutation.localUri,
				mutation.contentType,
				mutation.status,
				mutation.error ?? null,
				now,
				now,
			],
		);
	});
}

export async function loadPendingBabyAvatarMutations(userId: string) {
	const db = await getLocalDb();
	const rows = await db.getAllAsync<BabyAvatarMutationRow>(
		`
		SELECT user_id, baby_id, operation, local_uri, content_type, status, error
		FROM baby_avatar_mutation_queue
		WHERE user_id = ? AND status IN ('pending', 'failed')
		ORDER BY updated_at ASC
		`,
		[userId],
	);

	return rows.map(rowToMutation);
}

export async function loadPendingBabyAvatarMutation(userId: string, babyId: string) {
	const db = await getLocalDb();
	const row = await db.getFirstAsync<BabyAvatarMutationRow>(
		`
		SELECT user_id, baby_id, operation, local_uri, content_type, status, error
		FROM baby_avatar_mutation_queue
		WHERE user_id = ? AND baby_id = ? AND status = 'pending'
		`,
		[userId, babyId],
	);

	return row ? rowToMutation(row) : null;
}

export async function deleteBabyAvatarMutation(userId: string, babyId: string) {
	return runLocalDbWrite(async () => {
		const db = await getLocalDb();
		await db.runAsync(
			"DELETE FROM baby_avatar_mutation_queue WHERE user_id = ? AND baby_id = ?",
			[userId, babyId],
		);
	});
}

export async function markBabyAvatarMutationFailed(
	userId: string,
	babyId: string,
	error: string,
) {
	return runLocalDbWrite(async () => {
		const db = await getLocalDb();
		await db.runAsync(
			`
			UPDATE baby_avatar_mutation_queue
			SET status = 'failed', error = ?, updated_at = ?
			WHERE user_id = ? AND baby_id = ?
			`,
			[error, new Date().toISOString(), userId, babyId],
		);
	});
}

export async function applyPendingBabyAvatarMutations(
	userId: string,
	babies: BabyListItem[],
) {
	const mutations = await loadPendingBabyAvatarMutations(userId);

	if (mutations.length === 0) {
		return babies;
	}

	const mutationsByBabyId = new Map(mutations.map((mutation) => [mutation.babyId, mutation]));

	return babies.map((baby) => {
		const mutation = mutationsByBabyId.get(baby.id);

		if (!mutation) {
			return baby;
		}

		if (mutation.operation === "delete") {
			return {
				...baby,
				avatarObjectKey: null,
				avatarUrl: null,
			};
		}

		return {
			...baby,
			avatarObjectKey: "local:avatar",
			avatarUrl: mutation.localUri,
		};
	});
}

export async function syncPendingBabyAvatarMutations(userId: string) {
	const mutations = await loadPendingBabyAvatarMutations(userId);

	for (const mutation of mutations) {
		try {
			if (mutation.operation === "delete") {
				await removeBabyAvatar(mutation.babyId);
			} else {
				if (!mutation.localUri || !isAvatarContentType(mutation.contentType)) {
					throw new Error("Missing local avatar image.");
				}

				const imageResponse = await fetch(mutation.localUri);
				const imageBlob = await imageResponse.blob();
				const sizeBytes = imageBlob.size;

				if (sizeBytes > BABY_AVATAR_MAX_SIZE_BYTES) {
					throw new Error("Profile pictures must be JPG or PNG and 1 MB or smaller.");
				}

				const upload = await createBabyAvatarUpload(mutation.babyId, {
					contentType: mutation.contentType,
					sizeBytes,
				});
				const uploadResponse = await fetch(upload.uploadUrl, {
					body: imageBlob,
					headers: {
						"Content-Type": mutation.contentType,
					},
					method: "PUT",
				});

				if (!uploadResponse.ok) {
					throw new Error("Could not upload baby avatar.");
				}

				await confirmBabyAvatar(mutation.babyId, { objectKey: upload.objectKey });
			}

			await deleteBabyAvatarMutation(userId, mutation.babyId);
		} catch (error) {
			await markBabyAvatarMutationFailed(userId, mutation.babyId, getErrorMessage(error));
			throw error;
		}
	}
}

function rowToMutation(row: BabyAvatarMutationRow): PendingBabyAvatarMutation {
	return {
		babyId: row.baby_id,
		contentType: isAvatarContentType(row.content_type) ? row.content_type : null,
		error: row.error,
		localUri: row.local_uri,
		operation: row.operation,
		status: row.status,
		userId: row.user_id,
	};
}

function isAvatarContentType(
	value: unknown,
): value is CreateBabyAvatarUploadRequest["contentType"] {
	return isBabyAvatarContentType(value);
}

function getErrorMessage(error: unknown) {
	if (error instanceof Error) {
		return error.message;
	}

	return "Could not sync baby avatar.";
}
