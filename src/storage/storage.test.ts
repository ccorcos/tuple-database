import sqlite from "better-sqlite3"
import { sortedValues } from "../test/fixtures"
import { storageTestSuite } from "../test/storageTestSuite"
import { FileTupleStorage } from "./FileTupleStorage"
import { InMemoryTupleStorage } from "./InMemoryTupleStorage"
import { ReactiveTupleDatabase } from "./ReactiveTupleDatabase"
import { SQLiteTupleStorage } from "./SQLiteTupleStorage"
import { TupleDatabase } from "./TupleDatabase"

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

const tmpDir = __dirname + "/../../tmp/"

storageTestSuite(
	"TupleDatabase(FileTupleStorage)",
	sortedValues,
	(id) => new TupleDatabase(new FileTupleStorage(tmpDir + id))
)

storageTestSuite(
	"TupleDatabase(SQLiteTupleStorage)",
	sortedValues,
	(id) => new TupleDatabase(new SQLiteTupleStorage(sqlite(tmpDir + id + ".db")))
)

storageTestSuite(
	"ReactiveTupleDatabase(SQLiteTupleStorage)",
	sortedValues,
	(id) =>
		new ReactiveTupleDatabase(
			new SQLiteTupleStorage(sqlite(tmpDir + id + ".db"))
		)
)
