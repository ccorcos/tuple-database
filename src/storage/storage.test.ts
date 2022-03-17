import sqlite from "better-sqlite3"
import level from "level"
import * as path from "path"
import { asyncDatabaseTestSuite } from "../database/async/asyncDatabaseTestSuite"
import { AsyncTupleDatabase } from "../database/async/AsyncTupleDatabase"
import { AsyncTupleDatabaseClient } from "../database/async/AsyncTupleDatabaseClient"
import { databaseTestSuite } from "../database/sync/databaseTestSuite"
import { TupleDatabase } from "../database/sync/TupleDatabase"
import { TupleDatabaseClient } from "../database/sync/TupleDatabaseClient"
import { FileTupleStorage } from "./FileTupleStorage"
import { InMemoryTupleStorage } from "./InMemoryTupleStorage"
import { LevelTupleStorage } from "./LevelTupleStorage"
import { SQLiteTupleStorage } from "./SQLiteTupleStorage"

const tmpDir = path.resolve(__dirname, "/../../tmp")

databaseTestSuite(
	"TupleDatabaseClient(TupleDatabase(InMemoryTupleStorage))",
	() => new TupleDatabaseClient(new TupleDatabase(new InMemoryTupleStorage())),
	false
)

databaseTestSuite(
	"TupleDatabaseClient(TupleDatabase(FileTupleStorage))",
	(id) =>
		new TupleDatabaseClient(
			new TupleDatabase(new FileTupleStorage(path.join(tmpDir, id)))
		)
)

databaseTestSuite(
	"TupleDatabaseClient(TupleDatabase(SQLiteTupleStorage))",
	(id) =>
		new TupleDatabaseClient(
			new TupleDatabase(
				new SQLiteTupleStorage(sqlite(path.join(tmpDir, id + ".db")))
			)
		)
)

asyncDatabaseTestSuite(
	"AsyncTupleDatabaseClient(TupleDatabase(InMemoryTupleStorage))",
	() =>
		new AsyncTupleDatabaseClient(new TupleDatabase(new InMemoryTupleStorage())),
	false
)

asyncDatabaseTestSuite(
	"AsyncTupleDatabaseClient(AsyncTupleDatabase(InMemoryTupleStorage))",
	() =>
		new AsyncTupleDatabaseClient(
			new AsyncTupleDatabase(new InMemoryTupleStorage())
		),
	false
)

asyncDatabaseTestSuite(
	"AsyncTupleDatabaseClient(AsyncTupleDatabase(LevelTupleStorage))",
	(id) =>
		new AsyncTupleDatabaseClient(
			new AsyncTupleDatabase(
				new LevelTupleStorage(level(path.join(tmpDir, id + ".db")))
			)
		),
	true
)

// Test that the entire test suite works within a subspace.
asyncDatabaseTestSuite(
	"Subspace: AsyncTupleDatabaseClient(AsyncTupleDatabase(InMemoryTupleStorage))",
	() => {
		const store = new AsyncTupleDatabaseClient(
			new AsyncTupleDatabase(new InMemoryTupleStorage())
		)
		return store.subspace(["myApp"]) as any
	},
	false
)

databaseTestSuite(
	"Subspace: TupleDatabaseClient(TupleDatabase(InMemoryTupleStorage))",
	() => {
		const store = new TupleDatabaseClient(
			new TupleDatabase(new InMemoryTupleStorage())
		)
		return store.subspace(["myApp"]) as any
	},
	false
)
