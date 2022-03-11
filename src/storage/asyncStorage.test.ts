import level from "level"
import * as path from "path"
import { asyncStorageTestSuite } from "../test/asyncStorageTestSuite"
import { sortedValues } from "../test/fixtures"
import { AsyncTupleDatabase } from "./AsyncTupleDatabase"
import { InMemoryTupleStorage } from "./InMemoryTupleStorage"
import { LevelTupleStorage } from "./LevelTupleStorage"
import { ReactiveAsyncTupleDatabase } from "./ReactiveAsyncTupleDatabase"

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

const tmpDir = path.resolve(__dirname, "/../../tmp")

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
