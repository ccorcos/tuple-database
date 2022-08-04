/*

This is the current approach.
The main downside is writing all queries twice. Once for sync and once for async.

export const appendTriple = readWrite((tx, [e, a, v]: Triple) => {
	const nextOrder = getNextOrder(tx, [e, a])
	writeFact(tx, [e, a, nextOrder, v])
})

export const appendTripleAsync = readWriteAsync(
	async (tx, [e, a, v]: Triple) => {
		const nextOrder = await getNextOrderAsync(tx, [e, a])
		writeFact(tx, [e, a, nextOrder, v])
	}
)

export const getNextOrder = read((db, [e, a]: [string, string]) => {
	const lastOrder = db
		.subspace(["eaov", e, a])
		.scan({ reverse: true, limit: 1 })
		.map(({ key: [o, _v] }) => o)[0]

	const nextOrder = typeof lastOrder === "number" ? lastOrder + 1 : 0
	return nextOrder
})

export const getNextOrderAsync = readAsync(
	async (db, [e, a]: [string, string]) => {
		const results = await db
			.subspace(["eaov", e, a])
			.scan({ reverse: true, limit: 1 })
		const lastOrder = results.map(({ key: [o, _v] }) => o)[0]

		const nextOrder = typeof lastOrder === "number" ? lastOrder + 1 : 0
		return nextOrder
	}
)

export const writeFact = write((tx, fact: Fact) => {
	const [e, a, o, v] = fact
	tx.set(["eaov", e, a, o, v], null)
	tx.set(["aveo", a, v, e, o], null)
	tx.set(["veao", v, e, a, o], null)
})

*/

/*

Can we extract all of this query logic into a monad?


const getNextOrder =
	q.subspace(["eaov", e, a])
	 .scan({ reverse: true, limit: 1 })
	 .map(results => {
			const lastOrder = results.map(({ key: [o, _v] }) => o)[0]
			const nextOrder = typeof lastOrder === "number" ? lastOrder + 1 : 0
			return nextOrder
	 })

const writeFact = (fact: Fact) =>
	q.write((tx) => {
		const [e, a, o, v] = fact
		tx.set(["eaov", e, a, o, v], null)
		tx.set(["aveo", a, v, e, o], null)
		tx.set(["veao", v, e, a, o], null)
	})

const appendTriple = ([e, a, v]: Triple) =>
	getNextOrder
		.chain(nextOrder => {
			return writeFact([e, a, nextOrder, v])
		})

db.execute(appendTriple([id, "title", "Chet"]))


*/
