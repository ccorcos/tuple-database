import {
	AsyncTupleDatabaseClientApi,
	AsyncTupleTransactionApi,
} from "./asyncTypes"
import { retryAsync } from "./retryAsync"

// Similar to FoundationDb's abstraction: https://apple.github.io/foundationdb/class-scheduling.html
// Accepts a transaction or a database and allows you to compose transactions together.

// This outer function is just used for the schema type because currying is the only way
// we can partially infer generic type parameters.
// https://stackoverflow.com/questions/60377365/typescript-infer-type-of-generic-after-optional-first-generic
export function transactionalReadWriteAsync(retries = 5) {
	return function <I extends any[], O>(
		fn: (tx: AsyncTupleTransactionApi, ...args: I) => Promise<O>
	) {
		return async function (
			dbOrTx: AsyncTupleDatabaseClientApi | AsyncTupleTransactionApi,
			...args: I
		): Promise<O> {
			if (!("transact" in dbOrTx)) return fn(dbOrTx, ...args)
			return await retryAsync(retries, async () => {
				const tx = dbOrTx.transact()
				const result = await fn(tx, ...args)
				await tx.commit()
				return result
			})
		}
	}
}

/** @deprecated */
export const transactionalAsyncQuery = transactionalReadWriteAsync
