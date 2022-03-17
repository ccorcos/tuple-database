import { strict as assert } from "assert"
import { describe, it } from "mocha"
import { TupleDatabase } from "../database/sync/TupleDatabase"
import { TupleDatabaseClient } from "../database/sync/TupleDatabaseClient"
import { transactional } from "../helpers/transactional"
import { InMemoryTupleStorage } from "../storage/InMemoryTupleStorage"
import { Value } from "../storage/types"

type Fact = [Value, Value, Value]

const writeFact = transactional((tx, fact: Fact) => {
	const [e, a, v] = fact
	tx.set(["eav", e, a, v], null)
	tx.set(["ave", a, v, e], null)
	tx.set(["vea", v, e, a], null)
})

const removeFact = transactional((tx, fact: Fact) => {
	const [e, a, v] = fact
	tx.remove(["eav", e, a, v])
	tx.remove(["ave", a, v, e])
	tx.remove(["vea", v, e, a])
})

class Variable {
	constructor(public name: string) {}
}

// Just for dev UX.
function $(name: string) {
	return new Variable(name)
}

type Expression = [Value | Variable, Value | Variable, Value | Variable]

type Binding = { [varName: string]: Value }

const queryExpression = transactional((tx, expr: Expression): Binding[] => {
	const [$e, $a, $v] = expr
	if ($e instanceof Variable) {
		if ($a instanceof Variable) {
			if ($v instanceof Variable) {
				// ___
				return tx
					.scan({ prefix: ["eav"] })
					.map(([[_eav, e, a, v], _value]) => ({
						[$e.name]: e,
						[$a.name]: a,
						[$v.name]: v,
					}))
			} else {
				// __V
				return tx
					.scan({ prefix: ["vea", $v] })
					.map(([[_vea, _v, e, a], _value]) => ({
						[$e.name]: e,
						[$a.name]: a,
					}))
			}
		} else {
			if ($v instanceof Variable) {
				// A__
				return tx
					.scan({ prefix: ["ave", $a] })
					.map(([[_ave, _a, v, e], _value]) => ({
						[$e.name]: e,
						[$v.name]: v,
					}))
			} else {
				// A_V
				return tx
					.scan({ prefix: ["ave", $a, $v] })
					.map(([[_ave, _a, _v, e], _value]) => ({
						[$e.name]: e,
					}))
			}
		}
	} else {
		if ($a instanceof Variable) {
			if ($v instanceof Variable) {
				// E__
				return tx
					.scan({ prefix: ["eav", $e] })
					.map(([[_eav, _e, a, v], _value]) => ({
						[$a.name]: a,
						[$v.name]: v,
					}))
			} else {
				// E_V
				return tx
					.scan({ prefix: ["vea", $v, $e] })
					.map(([[_vea, _v, _e, a], _value]) => ({
						[$a.name]: a,
					}))
			}
		} else {
			if ($v instanceof Variable) {
				// EA_
				return tx
					.scan({ prefix: ["eav", $e, $a] })
					.map(([[_eav, _e, _a, v], _value]) => ({
						[$v.name]: v,
					}))
			} else {
				// EAV
				return tx
					.scan({ prefix: ["eav", $e, $a, $v] })
					.map(([[_eav, _e, _a, _v], _value]) => ({}))
			}
		}
	}
})

type Filter = Expression[]

const query = transactional((tx, filter: Filter): Binding[] => {
	const [first, ...rest] = filter

	if (rest.length === 0) return queryExpression(tx, first)

	const bindings = queryExpression(tx, first)

	const result = bindings
		.map((binding) => {
			// Substitute the rest of the variables for any bindings.
			const restFilter = rest.map((expr) => {
				return expr.map((item) =>
					item instanceof Variable && item.name in binding
						? binding[item.name]
						: item
				) as Expression
			})

			// Recursively evaluate
			const moreBindings = query(tx, restFilter)

			// Join the results
			return moreBindings.map((b) => ({ ...b, ...binding }))
		})
		// Flatten the arrays
		.reduce((acc, next) => acc.concat(next), [])

	return result
})

describe("Triplestore", () => {
	it("works", () => {
		const db = new TupleDatabaseClient(
			new TupleDatabase(new InMemoryTupleStorage())
		)

		const facts: Fact[] = [
			["1", "name", "chet"],
			["2", "name", "tk"],
			["3", "name", "joe"],
			["2", "worksFor", "1"],
			["3", "worksFor", "1"],
		]

		for (const fact of facts) {
			writeFact(db, fact)
		}

		assert.deepEqual(
			query(db, [
				[$("chet"), "name", "chet"],
				[$("id"), "worksFor", $("chet")],
				[$("id"), "name", $("name")],
			]),
			[
				{ name: "tk", id: "2", chet: "1" },
				{ name: "joe", id: "3", chet: "1" },
			]
		)
	})

	it("family example", () => {
		const db = new TupleDatabaseClient(
			new TupleDatabase(new InMemoryTupleStorage())
		)

		const facts: Fact[] = [
			["Chet", "parent", "Deborah"],
			["Deborah", "sibling", "Melanie"],
			["Tim", "parent", "Melanie"],
			["Becca", "parent", "Melanie"],
			["Roni", "parent", "Melanie"],
			["Deborah", "sibling", "Ruth"],
			["Izzy", "parent", "Ruth"],
			["Ali", "parent", "Ruth"],
			["Deborah", "sibling", "Sue"],
			["Ray", "parent", "Sue"],
			["Michelle", "parent", "Sue"],
			["Tyler", "parent", "Sue"],
			["Chet", "parent", "Leon"],
			["Leon", "sibling", "Stephanie"],
			["Matt", "parent", "Stephanie"],
			["Tom", "parent", "Stephanie"],
		]

		for (const fact of facts) {
			writeFact(db, fact)
		}

		const result = query(db, [
			["Chet", "parent", $("parent")],
			[$("parent"), "sibling", $("auntOrUncle")],
			[$("cousin"), "parent", $("auntOrUncle")],
		])

		assert.deepEqual(result, [
			{ cousin: "Becca", auntOrUncle: "Melanie", parent: "Deborah" },
			{ cousin: "Roni", auntOrUncle: "Melanie", parent: "Deborah" },
			{ cousin: "Tim", auntOrUncle: "Melanie", parent: "Deborah" },
			{ cousin: "Ali", auntOrUncle: "Ruth", parent: "Deborah" },
			{ cousin: "Izzy", auntOrUncle: "Ruth", parent: "Deborah" },
			{ cousin: "Michelle", auntOrUncle: "Sue", parent: "Deborah" },
			{ cousin: "Ray", auntOrUncle: "Sue", parent: "Deborah" },
			{ cousin: "Tyler", auntOrUncle: "Sue", parent: "Deborah" },
			{ cousin: "Matt", auntOrUncle: "Stephanie", parent: "Leon" },
			{ cousin: "Tom", auntOrUncle: "Stephanie", parent: "Leon" },
		])
	})
})
