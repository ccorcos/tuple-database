import sqlite from "better-sqlite3"
import level from "level"
import * as path from "path"
import { sortedValues } from "../test/fixtures"
import { asyncStorageTestSuite } from "./async/asyncStorageTestSuite"
import { AsyncTupleDatabase } from "./async/AsyncTupleDatabase"
import { AsyncTupleDatabaseClient } from "./async/AsyncTupleDatabaseClient"
import { FileTupleStorage } from "./FileTupleStorage"
import { InMemoryTupleStorage } from "./InMemoryTupleStorage"
import { LevelTupleStorage } from "./LevelTupleStorage"
import { SQLiteTupleStorage } from "./SQLiteTupleStorage"
import { storageTestSuite } from "./sync/storageTestSuite"
import { TupleDatabase } from "./sync/TupleDatabase"
import { TupleDatabaseClient } from "./sync/TupleDatabaseClient"

const tmpDir = path.resolve(__dirname, "/../../tmp")

storageTestSuite(
	"TupleDatabaseClient(TupleDatabase(InMemoryTupleStorage))",
	sortedValues,
	() => new TupleDatabaseClient(new TupleDatabase(new InMemoryTupleStorage())),
	false
)

storageTestSuite(
	"TupleDatabaseClient(TupleDatabase(FileTupleStorage))",
	sortedValues,
	(id) =>
		new TupleDatabaseClient(
			new TupleDatabase(new FileTupleStorage(path.join(tmpDir, id)))
		)
)

storageTestSuite(
	"TupleDatabaseClient(TupleDatabase(SQLiteTupleStorage))",
	sortedValues,
	(id) =>
		new TupleDatabaseClient(
			new TupleDatabase(
				new SQLiteTupleStorage(sqlite(path.join(tmpDir, id + ".db")))
			)
		)
)

asyncStorageTestSuite(
	"AsyncTupleDatabaseClient(TupleDatabase(InMemoryTupleStorage))",
	sortedValues,
	() =>
		new AsyncTupleDatabaseClient(new TupleDatabase(new InMemoryTupleStorage())),
	false
)

asyncStorageTestSuite(
	"AsyncTupleDatabaseClient(AsyncTupleDatabase(InMemoryTupleStorage))",
	sortedValues,
	() =>
		new AsyncTupleDatabaseClient(
			new AsyncTupleDatabase(new InMemoryTupleStorage())
		),
	false
)

asyncStorageTestSuite(
	"AsyncTupleDatabaseClient(AsyncTupleDatabase(LevelTupleStorage))",
	sortedValues,
	(id) =>
		new AsyncTupleDatabaseClient(
			new AsyncTupleDatabase(
				new LevelTupleStorage(level(path.join(tmpDir, id + ".db")))
			)
		)
)
