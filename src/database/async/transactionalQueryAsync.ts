import { TupleValuePair } from "../../main"
import {
	AsyncTupleDatabaseClientApi,
	AsyncTupleTransactionApi,
} from "./asyncTypes"

// Similar to FoundationDb's abstraction: https://apple.github.io/foundationdb/class-scheduling.html
// Accepts a transaction or a database and allows you to compose transactions together.

// This outer function is just used for the schema type because currying is the only way
// we can partially infer generic type parameters.
// https://stackoverflow.com/questions/60377365/typescript-infer-type-of-generic-after-optional-first-generic
export function transactionalAsyncQuery<
	S extends TupleValuePair = TupleValuePair
>(retries = 5) {
	return function <I extends any[], O>(
		fn: (tx: AsyncTupleTransactionApi<S>, ...args: I) => Promise<O>
	) {
		return async function (
			dbOrTx: AsyncTupleDatabaseClientApi<S> | AsyncTupleTransactionApi<S>,
			...args: I
		): Promise<O> {
			if ("set" in dbOrTx) return fn(dbOrTx, ...args)
			return await retry(retries, async () => {
				const tx = dbOrTx.transact()
				const result = await fn(tx, ...args)
				await tx.commit()
				return result
			})
		}
	}
}

async function retry<O>(retries: number, fn: () => Promise<O>) {
	while (true) {
		try {
			const result = await fn()
			return result
		} catch (error) {
			if (retries <= 0) throw error
			retries -= 1
		}
	}
}
