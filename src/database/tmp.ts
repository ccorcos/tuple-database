import { rootPath } from "../helpers/rootPath"
import { SQLiteStorage } from "./SQLiteStorage"
import { Index } from "./types"

const db = new SQLiteStorage(rootPath("chet.db"))

const people: Index = {
	name: "people",
	sort: [1, 1, 1],
}
db.transact()
	.set(people, ["Corcos", "Chet", 1])
	.set(people, ["Last", "Simon", 2])
	.commit()

console.log(db.scan(people))
