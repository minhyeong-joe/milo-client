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
  `);
}
