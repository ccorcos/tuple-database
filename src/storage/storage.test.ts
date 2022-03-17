import sqlite from "better-sqlite3"
import level from "level"
import * as path from "path"
import { sortedValues } from "../test/fixtures"
import { asyncStorageTestSuite } from "./async/asyncStorageTestSuite"
import { AsyncTupleDatabase } from "./async/AsyncTupleDatabase"
import { AsyncTupleDatabaseDialect } from "./async/AsyncTupleDatabaseDialect"
import { FileTupleStorage } from "./FileTupleStorage"
import { InMemoryTupleStorage } from "./InMemoryTupleStorage"
import { LevelTupleStorage } from "./LevelTupleStorage"
import { SQLiteTupleStorage } from "./SQLiteTupleStorage"
import { storageTestSuite } from "./sync/storageTestSuite"
import { TupleDatabase } from "./sync/TupleDatabase"
import { TupleDatabaseDialect } from "./sync/TupleDatabaseDialect"

const tmpDir = path.resolve(__dirname, "/../../tmp")

storageTestSuite(
	"TupleDatabaseDialect(TupleDatabase(InMemoryTupleStorage))",
	sortedValues,
	() => new TupleDatabaseDialect(new TupleDatabase(new InMemoryTupleStorage())),
	false
)

storageTestSuite(
	"TupleDatabaseDialect(TupleDatabase(FileTupleStorage))",
	sortedValues,
	(id) =>
		new TupleDatabaseDialect(
			new TupleDatabase(new FileTupleStorage(path.join(tmpDir, id)))
		)
)

storageTestSuite(
	"TupleDatabaseDialect(TupleDatabase(SQLiteTupleStorage))",
	sortedValues,
	(id) =>
		new TupleDatabaseDialect(
			new TupleDatabase(
				new SQLiteTupleStorage(sqlite(path.join(tmpDir, id + ".db")))
			)
		)
)

asyncStorageTestSuite(
	"AsyncTupleDatabaseDialect(TupleDatabase(InMemoryTupleStorage))",
	sortedValues,
	() =>
		new AsyncTupleDatabaseDialect(
			new TupleDatabase(new InMemoryTupleStorage())
		),
	false
)

asyncStorageTestSuite(
	"AsyncTupleDatabaseDialect(AsyncTupleDatabase(InMemoryTupleStorage))",
	sortedValues,
	() =>
		new AsyncTupleDatabaseDialect(
			new AsyncTupleDatabase(new InMemoryTupleStorage())
		),
	false
)

asyncStorageTestSuite(
	"AsyncTupleDatabaseDialect(AsyncTupleDatabase(LevelTupleStorage))",
	sortedValues,
	(id) =>
		new AsyncTupleDatabaseDialect(
			new AsyncTupleDatabase(
				new LevelTupleStorage(level(path.join(tmpDir, id + ".db")))
			)
		)
)
