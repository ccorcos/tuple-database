import sqlite from "better-sqlite3"
import level from "level"
import * as path from "path"
import { sortedValues } from "../test/fixtures"
import { asyncStorageTestSuite } from "./async/asyncStorageTestSuite"
import { AsyncTupleDatabase } from "./async/AsyncTupleDatabase"
import { ReactiveAsyncTupleDatabase } from "./async/ReactiveAsyncTupleDatabase"
import { TupleDatabaseAsyncClient } from "./async/TupleDatabaseAsyncClient"
import { FileTupleStorage } from "./FileTupleStorage"
import { InMemoryTupleStorage } from "./InMemoryTupleStorage"
import { LevelTupleStorage } from "./LevelTupleStorage"
import { SQLiteTupleStorage } from "./SQLiteTupleStorage"
import { ReactiveTupleDatabase } from "./sync/ReactiveTupleDatabase"
import { storageTestSuite } from "./sync/storageTestSuite"
import { TupleDatabase } from "./sync/TupleDatabase"
import { TupleDatabaseClient } from "./sync/TupleDatabaseClient"

const tmpDir = path.resolve(__dirname, "/../../tmp")

storageTestSuite(
	"TupleDatabase(InMemoryTupleStorage)",
	sortedValues,
	() => new TupleDatabase(new InMemoryTupleStorage()),
	false
)

storageTestSuite(
	"ReactiveTupleDatabase(InMemoryTupleStorage)",
	sortedValues,
	() => new ReactiveTupleDatabase(new InMemoryTupleStorage()),
	false
)

storageTestSuite(
	"TupleDatabase(FileTupleStorage)",
	sortedValues,
	(id) => new TupleDatabase(new FileTupleStorage(path.join(tmpDir, id)))
)

storageTestSuite(
	"TupleDatabase(SQLiteTupleStorage)",
	sortedValues,
	(id) =>
		new TupleDatabase(
			new SQLiteTupleStorage(sqlite(path.join(tmpDir, id + ".db")))
		)
)

storageTestSuite(
	"ReactiveTupleDatabase(SQLiteTupleStorage)",
	sortedValues,
	(id) =>
		new ReactiveTupleDatabase(
			new SQLiteTupleStorage(sqlite(path.join(tmpDir, id + ".db")))
		)
)

storageTestSuite(
	"TupleDatabaseClient(TupleDatabase(InMemoryTupleStorage))",
	sortedValues,
	() => new TupleDatabaseClient(new TupleDatabase(new InMemoryTupleStorage())),
	false
)

asyncStorageTestSuite(
	"AsyncTupleDatabase(InMemoryTupleStorage)",
	sortedValues,
	() => new AsyncTupleDatabase(new InMemoryTupleStorage()),
	false
)

asyncStorageTestSuite(
	"ReactiveAsyncTupleDatabase(InMemoryTupleStorage)",
	sortedValues,
	() => new ReactiveAsyncTupleDatabase(new InMemoryTupleStorage()),
	false
)

asyncStorageTestSuite(
	"AsyncTupleDatabase(LevelTupleStorage)",
	sortedValues,
	(id) =>
		new AsyncTupleDatabase(
			new LevelTupleStorage(level(path.join(tmpDir, id + ".db")))
		)
)

asyncStorageTestSuite(
	"ReactiveAsyncTupleDatabase(LevelTupleStorage)",
	sortedValues,
	(id) =>
		new ReactiveAsyncTupleDatabase(
			new LevelTupleStorage(level(path.join(tmpDir, id + ".db")))
		)
)

asyncStorageTestSuite(
	"TupleDatabaseAsyncClient(AsyncTupleDatabase(InMemoryTupleStorage))",
	sortedValues,
	() =>
		new TupleDatabaseAsyncClient(
			new AsyncTupleDatabase(new InMemoryTupleStorage())
		),
	false
)
