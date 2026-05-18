import * as SQLite from "expo-sqlite";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let initPromise: Promise<void> | null = null;
let writeQueue: Promise<unknown> = Promise.resolve();

export async function getLocalDb() {
	if (!dbPromise) {
		dbPromise = SQLite.openDatabaseAsync("milo.db");
	}

	const db = await dbPromise;

	if (!initPromise) {
		initPromise = initLocalDb(db);
	}

	await initPromise;
	return db;
}

export function runLocalDbWrite<T>(operation: () => Promise<T>) {
	const nextWrite = writeQueue
		.catch(() => undefined)
		.then(operation);

	writeQueue = nextWrite.catch(() => undefined);
	return nextWrite;
}

async function initLocalDb(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS baby_cache (
      user_id TEXT PRIMARY KEY NOT NULL,
      babies_json TEXT NOT NULL,
      selected_baby_id TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS routine_day_cache (
      user_id TEXT NOT NULL,
      baby_id TEXT NOT NULL,
      date TEXT NOT NULL,
      day_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, baby_id, date)
    );

    CREATE TABLE IF NOT EXISTS routine_meta_cache (
      user_id TEXT NOT NULL,
      baby_id TEXT NOT NULL,
      last_logged_json TEXT,
      next_start_date TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, baby_id)
    );

    CREATE TABLE IF NOT EXISTS routine_mutation_queue (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      baby_id TEXT NOT NULL,
      operation TEXT NOT NULL CHECK(operation IN ('create', 'update', 'delete')),
      kind TEXT NOT NULL,
      event_id TEXT,
      local_id TEXT,
      client_mutation_id TEXT,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'failed')),
      error TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS routine_mutation_queue_pending_idx
    ON routine_mutation_queue(user_id, baby_id, status, created_at);

    CREATE UNIQUE INDEX IF NOT EXISTS routine_mutation_queue_client_mutation_idx
    ON routine_mutation_queue(client_mutation_id)
    WHERE client_mutation_id IS NOT NULL;

    CREATE TABLE IF NOT EXISTS routine_stats_cache (
      user_id TEXT NOT NULL,
      baby_id TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      stats_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, baby_id, start_date, end_date)
    );

    CREATE INDEX IF NOT EXISTS routine_stats_cache_range_idx
    ON routine_stats_cache(user_id, baby_id, start_date, end_date);

    CREATE TABLE IF NOT EXISTS sync_job_queue (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      baby_id TEXT,
      scope TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'failed')),
      error TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS sync_job_queue_pending_idx
    ON sync_job_queue(user_id, status, created_at);

    CREATE TABLE IF NOT EXISTS growth_record_cache (
      user_id TEXT NOT NULL,
      baby_id TEXT NOT NULL,
      id TEXT NOT NULL,
      measured_date TEXT NOT NULL,
      record_json TEXT NOT NULL,
      sync_status TEXT NOT NULL CHECK(sync_status IN ('synced', 'pending', 'failed')),
      deleted_at TEXT,
      error TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, baby_id, id)
    );

    CREATE INDEX IF NOT EXISTS growth_record_cache_date_idx
    ON growth_record_cache(user_id, baby_id, measured_date DESC);

    CREATE TABLE IF NOT EXISTS growth_mutation_queue (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      baby_id TEXT NOT NULL,
      operation TEXT NOT NULL CHECK(operation IN ('create', 'update', 'delete')),
      growth_id TEXT,
      local_id TEXT,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'failed')),
      error TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS growth_mutation_queue_pending_idx
    ON growth_mutation_queue(user_id, baby_id, status, created_at);

    CREATE TABLE IF NOT EXISTS tag_cache (
      user_id TEXT NOT NULL,
      baby_id TEXT NOT NULL,
      id TEXT NOT NULL,
      tag_json TEXT NOT NULL,
      sync_status TEXT NOT NULL CHECK(sync_status IN ('synced', 'pending', 'failed')),
      deleted_at TEXT,
      error TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, baby_id, id)
    );

    CREATE INDEX IF NOT EXISTS tag_cache_type_idx
    ON tag_cache(user_id, baby_id, deleted_at);

    CREATE TABLE IF NOT EXISTS tag_mutation_queue (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      baby_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      operation TEXT NOT NULL CHECK(operation IN ('create', 'update', 'delete')),
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'failed')),
      error TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS tag_mutation_queue_pending_idx
    ON tag_mutation_queue(user_id, baby_id, status, created_at);

    CREATE TABLE IF NOT EXISTS baby_avatar_mutation_queue (
      user_id TEXT NOT NULL,
      baby_id TEXT NOT NULL,
      operation TEXT NOT NULL CHECK(operation IN ('replace', 'delete')),
      local_uri TEXT,
      content_type TEXT,
      status TEXT NOT NULL CHECK(status IN ('pending', 'failed')),
      error TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, baby_id)
    );

    CREATE INDEX IF NOT EXISTS baby_avatar_mutation_queue_pending_idx
    ON baby_avatar_mutation_queue(user_id, status, updated_at);

    CREATE TABLE IF NOT EXISTS baby_profile_mutation_queue (
      user_id TEXT NOT NULL,
      baby_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'failed')),
      error TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, baby_id)
    );

    CREATE INDEX IF NOT EXISTS baby_profile_mutation_queue_pending_idx
    ON baby_profile_mutation_queue(user_id, status, updated_at);
  `);

  await migrateTagMutationQueueCreateOperation(db);
}

async function migrateTagMutationQueueCreateOperation(db: SQLite.SQLiteDatabase) {
  const table = await db.getFirstAsync<{ sql: string | null }>(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'tag_mutation_queue'",
  );

  if (!table?.sql || table.sql.includes("'create'")) {
    return;
  }

  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.execAsync(`
      DROP TABLE IF EXISTS tag_mutation_queue_new;

      CREATE TABLE tag_mutation_queue_new (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        baby_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        operation TEXT NOT NULL CHECK(operation IN ('create', 'update', 'delete')),
        payload_json TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending', 'failed')),
        error TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      INSERT INTO tag_mutation_queue_new (
        id, user_id, baby_id, tag_id, operation, payload_json, status, error,
        retry_count, created_at, updated_at
      )
      SELECT
        id, user_id, baby_id, tag_id, operation, payload_json, status, error,
        retry_count, created_at, updated_at
      FROM tag_mutation_queue;

      DROP TABLE tag_mutation_queue;
      ALTER TABLE tag_mutation_queue_new RENAME TO tag_mutation_queue;

      CREATE INDEX IF NOT EXISTS tag_mutation_queue_pending_idx
      ON tag_mutation_queue(user_id, baby_id, status, created_at);
    `);
  });
}
