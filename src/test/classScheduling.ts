// Based on FoundationDb tutorial: https://apple.github.io/foundationdb/class-scheduling.html

import { InMemoryStorage } from "../storage/InMemoryStorage"
import { Tuple } from "../storage/types"

const db = new InMemoryStorage()

class Subspace {
	constructor(public prefix: Tuple) {}
	pack() {}
}

// const scheduling = db.subspace("scheduling")
// const course = scheduling.subspace("class")
// const attends = scheduling.subspace("attends")

// function addClass(tr, maxAttendance: number) {
// 	tr.set(course)
// }
// // @fdb.transactional
// // def add_class(tr, c):
// //     tr[course.pack((c,))] = fdb.tuple.pack((100,))
