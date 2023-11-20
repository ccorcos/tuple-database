import { randomId } from "../../helpers/randomId"
import * as t from "../../helpers/sortedTupleArray"
import * as tv from "../../helpers/sortedTupleValuePairs"
import {
	normalizeSubspaceScanArgs,
	prependPrefixToTuple,
	prependPrefixToWriteOps,
	removePrefixFromTuple,
	removePrefixFromTupleValuePairs,
	removePrefixFromWriteOps,
} from "../../helpers/subspaceHelpers"
import { KeyValuePair, Tuple, Value, WriteOps } from "../../storage/types"
import { TupleDatabaseApi } from "../sync/types"
import { ScanArgs, TxId, Unsubscribe } from "../types"
import {
	AsyncCallback,
	AsyncTupleDatabaseApi,
	AsyncTupleDatabaseClientApi,
	AsyncTupleRootTransactionApi,
	AsyncTupleTransactionApi,
} from "./asyncTypes"

export class AsyncTupleDatabaseClient implements AsyncTupleDatabaseClientApi {
	constructor(
		private db: AsyncTupleDatabaseApi | TupleDatabaseApi,
		public subspacePrefix: Tuple = []
	) {}

	async scan(args: ScanArgs = {}, txId?: TxId): Promise<KeyValuePair[]> {
		const storageScanArgs = normalizeSubspaceScanArgs(this.subspacePrefix, args)
		const pairs = await this.db.scan(storageScanArgs, txId)
		const result = removePrefixFromTupleValuePairs(this.subspacePrefix, pairs)
		return result as KeyValuePair[]
	}

	async subscribe(
		args: ScanArgs,
		callback: AsyncCallback
	): Promise<Unsubscribe> {
		const storageScanArgs = normalizeSubspaceScanArgs(this.subspacePrefix, args)
		return this.db.subscribe(storageScanArgs, (write, txId) => {
			return callback(
				removePrefixFromWriteOps(this.subspacePrefix, write) as WriteOps,
				txId
			)
		})
	}

	async commit(writes: WriteOps, txId?: TxId): Promise<void> {
		const prefixedWrites = prependPrefixToWriteOps(this.subspacePrefix, writes)
		await this.db.commit(prefixedWrites, txId)
	}

	async cancel(txId: string) {
		return this.db.cancel(txId)
	}

	async get(tuple: Tuple, txId?: TxId): Promise<Value | undefined> {
		// Not sure why these types aren't happy
		// @ts-ignore
		const items = await this.scan<T, []>({ gte: tuple, lte: tuple }, txId)
		if (items.length === 0) return
		if (items.length > 1) throw new Error("Get expects only one value.")
		const pair = items[0]
		return pair.value
	}

	async exists(tuple: Tuple, txId?: TxId): Promise<boolean> {
		// Not sure why these types aren't happy
		// @ts-ignore
		const items = await this.scan({ gte: tuple, lte: tuple }, txId)
		if (items.length === 0) return false
		return items.length >= 1
	}

	// Subspace
	subspace(prefix: Tuple): AsyncTupleDatabaseClient {
		const subspacePrefix = [...this.subspacePrefix, ...prefix]
		return new AsyncTupleDatabaseClient(this.db, subspacePrefix)
	}

	// Transaction
	transact(txId?: TxId, writes?: WriteOps): AsyncTupleRootTransactionApi {
		const id = txId || randomId()
		return new AsyncTupleRootTransaction(
			this.db,
			this.subspacePrefix,
			id,
			writes
		)
	}

	async close() {
		return this.db.close()
	}
}

export class AsyncTupleRootTransaction implements AsyncTupleRootTransactionApi {
	constructor(
		private db: AsyncTupleDatabaseApi | TupleDatabaseApi,
		public subspacePrefix: Tuple,
		public id: TxId,
		writes?: WriteOps
	) {
		this.writes = { set: [], remove: [], ...writes }
	}

	committed = false
	canceled = false
	writes: Required<WriteOps>

	private checkActive() {
		if (this.committed) throw new Error("Transaction already committed")
		if (this.canceled) throw new Error("Transaction already canceled")
	}

	async scan(args: ScanArgs = {}): Promise<KeyValuePair[]> {
		this.checkActive()

		const { limit: resultLimit, ...scanArgs } = normalizeSubspaceScanArgs(
			this.subspacePrefix,
			args
		)

		// We don't want to include the limit in this scan.
		const sets = tv.scan(this.writes.set, scanArgs)
		const removes = t.scan(this.writes.remove, scanArgs)

		// If we've removed items from this range, then lets make sure to fetch enough
		// from storage for the final result limit.
		const scanLimit = resultLimit ? resultLimit + removes.length : undefined

		const pairs = await this.db.scan({ ...scanArgs, limit: scanLimit }, this.id)
		const result = removePrefixFromTupleValuePairs(this.subspacePrefix, pairs)

		for (const { key: fullTuple, value } of sets) {
			const tuple = removePrefixFromTuple(this.subspacePrefix, fullTuple)
			// Make sure we insert in reverse if the scan is in reverse.
			tv.set(result, tuple, value, scanArgs.reverse)
		}
		for (const fullTuple of removes) {
			const tuple = removePrefixFromTuple(this.subspacePrefix, fullTuple)
			tv.remove(result, tuple, scanArgs.reverse)
		}

		// Make sure to truncate the results if we added items to the result set.
		if (resultLimit) {
			if (result.length > resultLimit) {
				result.splice(resultLimit, result.length)
			}
		}

		return result as KeyValuePair[]
	}

	async get(tuple: Tuple): Promise<Value | undefined> {
		this.checkActive()
		const fullTuple = prependPrefixToTuple(this.subspacePrefix, tuple)

		if (tv.exists(this.writes.set, fullTuple)) {
			// TODO: binary searching twice unnecessarily...
			return tv.get(this.writes.set, fullTuple)
		}
		if (t.exists(this.writes.remove, fullTuple)) {
			return
		}
		const items = await this.db.scan(
			{ gte: fullTuple, lte: fullTuple },
			this.id
		)
		if (items.length === 0) return
		if (items.length > 1) throw new Error("Get expects only one value.")
		const pair = items[0]
		return pair.value
	}

	async exists(tuple: Tuple): Promise<boolean> {
		this.checkActive()
		const fullTuple = prependPrefixToTuple(this.subspacePrefix, tuple)

		if (tv.exists(this.writes.set, fullTuple)) {
			return true
		}
		if (t.exists(this.writes.remove, fullTuple)) {
			return false
		}
		const items = await this.db.scan(
			{ gte: fullTuple, lte: fullTuple },
			this.id
		)
		if (items.length === 0) return false
		return items.length >= 1
	}

	// ReadApis
	set(tuple: Tuple, value: Value): AsyncTupleRootTransactionApi {
		this.checkActive()
		const fullTuple = prependPrefixToTuple(this.subspacePrefix, tuple)
		t.remove(this.writes.remove, fullTuple)
		tv.set(this.writes.set, fullTuple, value)
		return this
	}

	remove(tuple: Tuple): AsyncTupleRootTransactionApi {
		this.checkActive()
		const fullTuple = prependPrefixToTuple(this.subspacePrefix, tuple)
		tv.remove(this.writes.set, fullTuple)
		t.set(this.writes.remove, fullTuple)
		return this
	}

	write(writes: WriteOps): AsyncTupleRootTransactionApi {
		this.checkActive()

		// If you're calling this function, then the order of these opertions
		// shouldn't matter.
		const { set, remove } = writes
		for (const tuple of remove || []) {
			this.remove(tuple)
		}
		for (const { key, value } of set || []) {
			this.set(key, value)
		}
		return this
	}

	async commit() {
		this.checkActive()
		this.committed = true
		return this.db.commit(this.writes, this.id)
	}

	async cancel() {
		this.checkActive()
		this.canceled = true
		return this.db.cancel(this.id)
	}

	subspace(prefix: Tuple): AsyncTupleTransactionApi {
		this.checkActive()
		// TODO: types.
		return new AsyncTupleSubspaceTransaction(this as any, prefix)
	}
}

export class AsyncTupleSubspaceTransaction implements AsyncTupleTransactionApi {
	constructor(
		private tx: AsyncTupleTransactionApi,
		public subspacePrefix: Tuple
	) {}

	async scan(args: ScanArgs = {}): Promise<KeyValuePair[]> {
		const storageScanArgs = normalizeSubspaceScanArgs(this.subspacePrefix, args)
		const pairs = await this.tx.scan(storageScanArgs)
		const result = removePrefixFromTupleValuePairs(this.subspacePrefix, pairs)
		return result as KeyValuePair[]
	}

	async get(tuple: Tuple): Promise<Value | undefined> {
		const fullTuple = prependPrefixToTuple(this.subspacePrefix, tuple)
		return this.tx.get(fullTuple)
	}

	async exists(tuple: Tuple): Promise<boolean> {
		const fullTuple = prependPrefixToTuple(this.subspacePrefix, tuple)
		return this.tx.exists(fullTuple)
	}

	// ReadApis
	set(tuple: Tuple, value: Value): AsyncTupleTransactionApi {
		const fullTuple = prependPrefixToTuple(this.subspacePrefix, tuple)
		this.tx.set(fullTuple, value)
		return this
	}

	remove(tuple: Tuple): AsyncTupleTransactionApi {
		const fullTuple = prependPrefixToTuple(this.subspacePrefix, tuple)
		this.tx.remove(fullTuple)
		return this
	}

	write(writes: WriteOps): AsyncTupleTransactionApi {
		// If you're calling this function, then the order of these opertions
		// shouldn't matter.
		const { set, remove } = writes
		for (const tuple of remove || []) {
			this.remove(tuple)
		}
		for (const { key, value } of set || []) {
			this.set(key, value)
		}
		return this
	}

	subspace(prefix: Tuple): AsyncTupleTransactionApi {
		return new AsyncTupleSubspaceTransaction(this.tx, [
			...this.subspacePrefix,
			...prefix,
		])
	}
}
