// Based on FoundationDb tutorial: https://apple.github.io/foundationdb/class-scheduling.html

import { strict as assert } from "assert"
import { flatten, range } from "lodash"
import { describe, it } from "mocha"
import { Subspace } from "../helpers/Subspace"
import { transactional } from "../helpers/transactional"
import { InMemoryTupleDatabase } from "../storage/InMemoryTupleDatabase"
import { ReadOnlyTupleDatabase } from "../storage/TupleDatabase"

const scheduling = new Subspace("scheduling")
const course = scheduling.subspace("class")
const attends = scheduling.subspace("attends")

const addClass = transactional(
	(tr, className: string, remainingSeats: number) => {
		tr.set(course.pack([className]), remainingSeats)
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

const init = transactional((tr) => {
	// Clear the directory.
	for (const [tuple] of tr.scan()) {
		tr.remove(tuple)
	}

	for (const className of classNames) {
		addClass(tr, className, 4)
	}
})

function availableClasses(db: ReadOnlyTupleDatabase) {
	return db
		.scan(course.range())
		.filter(([tuple, value]) => value > 0)
		.map(([tuple, value]) => {
			const className = course.unpack(tuple)[0] as string
			return className
		})
}

const signup = transactional((tr, student: string, className: string) => {
	const record = attends.pack([student, className])
	if (tr.exists(record)) return // Already signed up.

	const remainingSeats = tr.get(course.pack([className]))
	if (remainingSeats <= 0) throw new Error("No remaining seats.")

	const classes = tr.scan(attends.range([student]))
	if (classes.length >= 5) throw new Error("Too many classes.")

	tr.set(course.pack([className]), remainingSeats - 1)
	tr.set(record, null)
})

const drop = transactional((tr, student: string, className: string) => {
	const record = attends.pack([student, className])

	if (!tr.exists(record)) return // Not taking this class.

	const remainingSeats = tr.get(course.pack([className]))
	tr.set(course.pack([className]), remainingSeats + 1)
	tr.remove(record)
})

const switchClasses = transactional(
	(tr, student: string, classes: { old: string; new: string }) => {
		drop(tr, student, classes.old)
		signup(tr, student, classes.new)
	}
)

function getClasses(db: ReadOnlyTupleDatabase, student: string) {
	const classes = db
		.scan(attends.range([student]))
		.map(([tuple, value]) => attends.unpack(tuple)[1] as string)
	return classes
}

describe("Class Scheduling Example", () => {
	const [class1, class2, class3, class4, class5, class6] = classNames
	const [student1, student2, student3, student4, student5] = range(0, 5).map(
		(i) => `student${i}`
	)

	it("signup", () => {
		const db = new InMemoryTupleDatabase()
		init(db)

		assert.equal(getClasses(db, student1).length, 0)
		signup(db, student1, class1)
		assert.equal(getClasses(db, student1).length, 1)
	})

	it("signup - already signed up", () => {
		const db = new InMemoryTupleDatabase()
		init(db)

		assert.equal(getClasses(db, student1).length, 0)
		signup(db, student1, class1)
		assert.equal(getClasses(db, student1).length, 1)
		signup(db, student1, class1)
		assert.equal(getClasses(db, student1).length, 1)
	})

	it("signup more than one", () => {
		const db = new InMemoryTupleDatabase()
		init(db)

		assert.equal(getClasses(db, student1).length, 0)
		assert.equal(getClasses(db, student2).length, 0)
		assert.equal(db.get(course.pack([class1])), 4)
		assert.equal(db.get(course.pack([class2])), 4)

		signup(db, student1, class1)
		assert.equal(getClasses(db, student1).length, 1)
		assert.equal(db.get(course.pack([class1])), 3)

		signup(db, student1, class2)
		assert.equal(getClasses(db, student1).length, 2)
		assert.equal(db.get(course.pack([class2])), 3)

		signup(db, student2, class2)

		assert.equal(getClasses(db, student1).length, 2)
		assert.equal(getClasses(db, student2).length, 1)

		assert.equal(db.get(course.pack([class2])), 2)
	})

	it("drop", () => {
		const db = new InMemoryTupleDatabase()
		init(db)

		assert.equal(getClasses(db, student1).length, 0)
		signup(db, student1, class1)
		assert.equal(getClasses(db, student1).length, 1)
		drop(db, student1, class1)
		assert.equal(getClasses(db, student1).length, 0)
	})

	it("drop - not taking this class", () => {
		const db = new InMemoryTupleDatabase()
		init(db)

		assert.equal(getClasses(db, student1).length, 0)
		signup(db, student1, class1)
		assert.equal(getClasses(db, student1).length, 1)
		drop(db, student1, class2)
		assert.equal(getClasses(db, student1).length, 1)
	})

	it("signup - max attendance", () => {
		const db = new InMemoryTupleDatabase()
		init(db)

		signup(db, student1, class1)
		signup(db, student2, class1)
		signup(db, student3, class1)
		signup(db, student4, class1)

		assert.equal(db.get(course.pack([class1])), 0)

		assert.throws(() => signup(db, student5, class1))
	})

	it("signup - too many classes", () => {
		const db = new InMemoryTupleDatabase()
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
		const db = new InMemoryTupleDatabase()
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
		const db = new InMemoryTupleDatabase()
		init(db)

		assert.ok(availableClasses(db).includes(class1))

		signup(db, student1, class1)
		signup(db, student2, class1)
		signup(db, student3, class1)
		signup(db, student4, class1)

		assert.ok(!availableClasses(db).includes(class1))
	})
})
