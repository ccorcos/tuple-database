// Based on FoundationDb tutorial: https://apple.github.io/foundationdb/class-scheduling.html

import { strict as assert } from "assert"
import { flatten, range } from "lodash"
import { describe, it } from "mocha"
import { transactionalQuery } from "../database/sync/transactional"
import { ReadOnlyTupleDatabaseClientApi } from "../database/sync/types"
import {
	InMemoryTupleStorage,
	TupleDatabase,
	TupleDatabaseClient,
} from "../main"

type Schema =
	| [["scheduling", "class", string], number]
	| [["scheduling", "attends", string, string], null]

const addClass = transactionalQuery<Schema>()(
	(tr, className: string, remainingSeats: number) => {
		const course = tr.subspace(["scheduling", "class"])
		course.set([className], remainingSeats)
	}
)

// Generate 1,620 classes like '9:00 chem for dummies'
const levels = [
	"intro",
	"for dummies",
	"remedial",
	"101",
	"201",
	"301",
	"mastery",
	"lab",
	"seminar",
]

const types = [
	"chem",
	"bio",
	"cs",
	"geometry",
	"calc",
	"alg",
	"film",
	"music",
	"art",
	"dance",
]

const times = range(2, 20).map((t) => `${t}:00`)

const classNames = flatten(
	flatten(
		levels.map((level) =>
			types.map((type) => times.map((time) => [level, type, time].join(" ")))
		)
	)
)

const init = transactionalQuery<Schema>()((tr) => {
	// Clear the directory.
	for (const [tuple] of tr.scan()) {
		tr.remove(tuple)
	}

	for (const className of classNames) {
		addClass(tr, className, 4)
	}
})

function availableClasses(db: ReadOnlyTupleDatabaseClientApi<Schema>) {
	return db
		.subspace(["scheduling", "class"])
		.scan()
		.filter(([tuple, value]) => value > 0)
		.map(([tuple, value]) => {
			const className = tuple[0]
			return className
		})
}

const signup = transactionalQuery<Schema>()(
	(tr, student: string, className: string) => {
		const attends = tr.subspace(["scheduling", "attends"])
		const course = tr.subspace(["scheduling", "class"])

		if (attends.exists([student, className])) return // Already signed up.

		const remainingSeats = course.get([className])!
		if (remainingSeats <= 0) throw new Error("No remaining seats.")

		const classes = attends.scan({ prefix: [student] })
		if (classes.length >= 5) throw new Error("Too many classes.")

		course.set([className], remainingSeats - 1)
		attends.set([student, className], null)
	}
)

const drop = transactionalQuery<Schema>()(
	(tr, student: string, className: string) => {
		const attends = tr.subspace(["scheduling", "attends"])
		const course = tr.subspace(["scheduling", "class"])

		if (!attends.exists([student, className])) return // Not taking this class.

		const remainingSeats = course.get([className])!
		course.set([className], remainingSeats + 1)
		attends.remove([student, className])
	}
)

const switchClasses = transactionalQuery<Schema>()(
	(tr, student: string, classes: { old: string; new: string }) => {
		drop(tr, student, classes.old)
		signup(tr, student, classes.new)
	}
)

function getClasses(
	db: ReadOnlyTupleDatabaseClientApi<Schema>,
	student: string
) {
	const attends = db.subspace(["scheduling", "attends"])
	const classes = attends
		.scan({ prefix: [student] })
		.map(([tuple, value]) => tuple[1])
	return classes
}

describe("Class Scheduling Example", () => {
	const [class1, class2, class3, class4, class5, class6] = classNames
	const [student1, student2, student3, student4, student5] = range(0, 5).map(
		(i) => `student${i}`
	)

	it("signup", () => {
		const db = new TupleDatabaseClient<Schema>(
			new TupleDatabase(new InMemoryTupleStorage())
		)
		init(db)

		assert.equal(getClasses(db, student1).length, 0)
		signup(db, student1, class1)
		assert.equal(getClasses(db, student1).length, 1)
	})

	it("signup - already signed up", () => {
		const db = new TupleDatabaseClient<Schema>(
			new TupleDatabase(new InMemoryTupleStorage())
		)
		init(db)

		assert.equal(getClasses(db, student1).length, 0)
		signup(db, student1, class1)
		assert.equal(getClasses(db, student1).length, 1)
		signup(db, student1, class1)
		assert.equal(getClasses(db, student1).length, 1)
	})

	it("signup more than one", () => {
		const db = new TupleDatabaseClient<Schema>(
			new TupleDatabase(new InMemoryTupleStorage())
		)
		init(db)

		assert.equal(getClasses(db, student1).length, 0)
		assert.equal(getClasses(db, student2).length, 0)

		const course = db.subspace(["scheduling", "class"])

		assert.equal(course.get([class1]), 4)
		assert.equal(course.get([class2]), 4)

		signup(db, student1, class1)
		assert.equal(getClasses(db, student1).length, 1)
		assert.equal(course.get([class1]), 3)

		signup(db, student1, class2)
		assert.equal(getClasses(db, student1).length, 2)
		assert.equal(course.get([class2]), 3)

		signup(db, student2, class2)

		assert.equal(getClasses(db, student1).length, 2)
		assert.equal(getClasses(db, student2).length, 1)

		assert.equal(course.get([class2]), 2)
	})

	it("drop", () => {
		const db = new TupleDatabaseClient<Schema>(
			new TupleDatabase(new InMemoryTupleStorage())
		)
		init(db)

		assert.equal(getClasses(db, student1).length, 0)
		signup(db, student1, class1)
		assert.equal(getClasses(db, student1).length, 1)
		drop(db, student1, class1)
		assert.equal(getClasses(db, student1).length, 0)
	})

	it("drop - not taking this class", () => {
		const db = new TupleDatabaseClient<Schema>(
			new TupleDatabase(new InMemoryTupleStorage())
		)
		init(db)

		assert.equal(getClasses(db, student1).length, 0)
		signup(db, student1, class1)
		assert.equal(getClasses(db, student1).length, 1)
		drop(db, student1, class2)
		assert.equal(getClasses(db, student1).length, 1)
	})

	it("signup - max attendance", () => {
		const db = new TupleDatabaseClient<Schema>(
			new TupleDatabase(new InMemoryTupleStorage())
		)
		init(db)

		signup(db, student1, class1)
		signup(db, student2, class1)
		signup(db, student3, class1)
		signup(db, student4, class1)

		const course = db.subspace(["scheduling", "class"])

		assert.equal(course.get([class1]), 0)
		assert.throws(() => signup(db, student5, class1))
	})

	it("signup - too many classes", () => {
		const db = new TupleDatabaseClient<Schema>(
			new TupleDatabase(new InMemoryTupleStorage())
		)
		init(db)

		signup(db, student1, class1)
		signup(db, student1, class2)
		signup(db, student1, class3)
		signup(db, student1, class4)
		signup(db, student1, class5)

		assert.equal(getClasses(db, student1).length, 5)

		assert.throws(() => signup(db, student1, class6))
	})

	it("switchClasses", () => {
		const db = new TupleDatabaseClient<Schema>(
			new TupleDatabase(new InMemoryTupleStorage())
		)
		init(db)

		signup(db, student1, class1)
		signup(db, student1, class2)
		signup(db, student1, class3)
		signup(db, student1, class4)
		signup(db, student1, class5)

		assert.equal(getClasses(db, student1).length, 5)

		switchClasses(db, student1, { old: class5, new: class6 })
		const classes = getClasses(db, student1)
		assert.equal(classes.length, 5)
		assert.ok(classes.includes(class6))
		assert.ok(!classes.includes(class5))
	})

	it("availableClasses", () => {
		const db = new TupleDatabaseClient<Schema>(
			new TupleDatabase(new InMemoryTupleStorage())
		)
		init(db)

		assert.ok(availableClasses(db).includes(class1))

		signup(db, student1, class1)
		signup(db, student2, class1)
		signup(db, student3, class1)
		signup(db, student4, class1)

		assert.ok(!availableClasses(db).includes(class1))
	})
})
