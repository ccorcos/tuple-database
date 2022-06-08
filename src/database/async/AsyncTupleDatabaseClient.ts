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
import { KeyValuePair, Tuple, WriteOps } from "../../storage/types"
import { TupleDatabaseApi } from "../sync/types"
import {
	FilterTupleValuePairByPrefix,
	RemoveTupleValuePairPrefix,
	TuplePrefix,
	ValueForTuple,
} from "../typeHelpers"
import { ScanArgs, TxId, Unsubscribe } from "../types"
import {
	AsyncCallback,
	AsyncTupleDatabaseApi,
	AsyncTupleDatabaseClientApi,
	AsyncTupleTransactionApi,
} from "./asyncTypes"

export class AsyncTupleDatabaseClient<S extends KeyValuePair = KeyValuePair>
	implements AsyncTupleDatabaseClientApi<S>
{
	constructor(
		private db: AsyncTupleDatabaseApi | TupleDatabaseApi,
		public subspacePrefix: Tuple = []
	) {}

	async scan<T extends S["key"], P extends TuplePrefix<T>>(
		args: ScanArgs<T, P> = {},
		txId?: TxId
	): Promise<FilterTupleValuePairByPrefix<S, P>[]> {
		const storageScanArgs = normalizeSubspaceScanArgs(this.subspacePrefix, args)
		const pairs = await this.db.scan(storageScanArgs, txId)
		const result = removePrefixFromTupleValuePairs(this.subspacePrefix, pairs)
		return result as FilterTupleValuePairByPrefix<S, P>[]
	}

	async subscribe<T extends S["key"], P extends TuplePrefix<T>>(
		args: ScanArgs<T, P>,
		callback: AsyncCallback<FilterTupleValuePairByPrefix<S, P>>
	): Promise<Unsubscribe> {
		const storageScanArgs = normalizeSubspaceScanArgs(this.subspacePrefix, args)
		return this.db.subscribe(storageScanArgs, (write, txId) => {
			return callback(
				removePrefixFromWriteOps(this.subspacePrefix, write) as WriteOps<
					FilterTupleValuePairByPrefix<S, P>
				>,
				txId
			)
		})
	}

	async commit(writes: WriteOps<S>, txId?: TxId): Promise<void> {
		const prefixedWrites = prependPrefixToWriteOps(this.subspacePrefix, writes)
		await this.db.commit(prefixedWrites, txId)
	}

	async cancel(txId: string) {
		return this.db.cancel(txId)
	}

	async get<T extends S["key"]>(
		tuple: T,
		txId?: TxId
	): Promise<ValueForTuple<S, T> | undefined> {
		// Not sure why these types aren't happy
		// @ts-ignore
		const items = await this.scan<T, []>({ gte: tuple, lte: tuple }, txId)
		if (items.length === 0) return
		if (items.length > 1) throw new Error("Get expects only one value.")
		const pair = items[0]
		return pair.value
	}

	async exists<T extends S["key"]>(tuple: T, txId?: TxId): Promise<boolean> {
		// Not sure why these types aren't happy
		// @ts-ignore
		const items = await this.scan({ gte: tuple, lte: tuple }, txId)
		if (items.length === 0) return false
		return items.length >= 1
	}

	// Subspace
	subspace<P extends TuplePrefix<S["key"]>>(
		prefix: P
	): AsyncTupleDatabaseClient<RemoveTupleValuePairPrefix<S, P>> {
		const subspacePrefix = [...this.subspacePrefix, ...prefix]
		return new AsyncTupleDatabaseClient(this.db, subspacePrefix)
	}

	// Transaction
	transact(txId?: TxId): AsyncTupleTransactionApi<S> {
		const id = txId || randomId()
		return new AsyncTupleTransaction(this.db, this.subspacePrefix, id)
	}

	async close() {
		return this.db.close()
	}
}

export class AsyncTupleTransaction<S extends KeyValuePair>
	implements AsyncTupleTransactionApi<S>
{
	constructor(
		private db: AsyncTupleDatabaseApi | TupleDatabaseApi,
		public subspacePrefix: Tuple,
		public id: TxId
	) {}

	committed = false
	canceled = false
	writes: Required<WriteOps<S>> = { set: [], remove: [] }

	private checkActive() {
		if (this.committed) throw new Error("Transaction already committed")
		if (this.canceled) throw new Error("Transaction already canceled")
	}

	async scan<T extends S["key"], P extends TuplePrefix<T>>(
		args: ScanArgs<T, P> = {}
	): Promise<FilterTupleValuePairByPrefix<S, P>[]> {
		this.checkActive()

		const storageScanArgs = normalizeSubspaceScanArgs(this.subspacePrefix, args)
		const pairs = await this.db.scan(storageScanArgs, this.id)
		const result = removePrefixFromTupleValuePairs(this.subspacePrefix, pairs)

		const sets = tv.scan(this.writes.set, storageScanArgs)
		for (const { key: fullTuple, value } of sets) {
			const tuple = removePrefixFromTuple(this.subspacePrefix, fullTuple)
			// Make sure we insert in reverse if the scan is in reverse.
			tv.set(result, tuple, value, storageScanArgs.reverse)
		}
		const removes = t.scan(this.writes.remove, storageScanArgs)
		for (const fullTuple of removes) {
			const tuple = removePrefixFromTuple(this.subspacePrefix, fullTuple)
			tv.remove(result, tuple, storageScanArgs.reverse)
		}

		// Make sure to trunace the results if we added items to the result set.
		if (storageScanArgs.limit) {
			if (result.length > storageScanArgs.limit) {
				result.splice(storageScanArgs.limit, result.length)
			}
		}

		return result as FilterTupleValuePairByPrefix<S, P>[]
	}

	async get<T extends S["key"]>(
		tuple: T
	): Promise<ValueForTuple<S, T> | undefined> {
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

	async exists<T extends S["key"]>(tuple: T): Promise<boolean> {
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
	set<T extends S>(
		tuple: T["key"],
		value: T["value"]
	): AsyncTupleTransactionApi<S> {
		this.checkActive()
		const fullTuple = prependPrefixToTuple(this.subspacePrefix, tuple)
		t.remove(this.writes.remove, fullTuple)
		tv.set(this.writes.set, fullTuple, value)
		return this
	}

	remove(tuple: S["key"]): AsyncTupleTransactionApi<S> {
		this.checkActive()
		const fullTuple = prependPrefixToTuple(this.subspacePrefix, tuple)
		tv.remove(this.writes.set, fullTuple)
		t.set(this.writes.remove, fullTuple)
		return this
	}

	write(writes: WriteOps<S>): AsyncTupleTransactionApi<S> {
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

	subspace<P extends TuplePrefix<S["key"]>>(
		prefix: P
	): AsyncTupleTransactionApi<RemoveTupleValuePairPrefix<S, P>> {
		this.checkActive()
		// TODO: types.
		return new AsyncTupleTransactionSubspace(this as any, prefix)
	}
}

export class AsyncTupleTransactionSubspace<S extends KeyValuePair>
	implements AsyncTupleTransactionApi<S>
{
	constructor(
		private tx: AsyncTupleTransactionApi<any>,
		public subspacePrefix: Tuple
	) {}

	async scan<T extends S["key"], P extends TuplePrefix<T>>(
		args: ScanArgs<T, P> = {}
	): Promise<FilterTupleValuePairByPrefix<S, P>[]> {
		const storageScanArgs = normalizeSubspaceScanArgs(this.subspacePrefix, args)
		const pairs = await this.tx.scan(storageScanArgs)
		const result = removePrefixFromTupleValuePairs(this.subspacePrefix, pairs)
		return result as FilterTupleValuePairByPrefix<S, P>[]
	}

	async get<T extends S["key"]>(
		tuple: T
	): Promise<ValueForTuple<S, T> | undefined> {
		const fullTuple = prependPrefixToTuple(this.subspacePrefix, tuple)
		return this.tx.get(fullTuple)
	}

	async exists<T extends S["key"]>(tuple: T): Promise<boolean> {
		const fullTuple = prependPrefixToTuple(this.subspacePrefix, tuple)
		return this.tx.exists(fullTuple)
	}

	// ReadApis
	set<T extends S>(
		tuple: T["key"],
		value: T["value"]
	): AsyncTupleTransactionApi<S> {
		const fullTuple = prependPrefixToTuple(this.subspacePrefix, tuple)
		this.tx.set(fullTuple, value)
		return this
	}

	remove(tuple: S["key"]): AsyncTupleTransactionApi<S> {
		const fullTuple = prependPrefixToTuple(this.subspacePrefix, tuple)
		this.tx.remove(fullTuple)
		return this
	}

	write(writes: WriteOps<S>): AsyncTupleTransactionApi<S> {
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
		return this.tx.commit()
	}

	async cancel() {
		return this.tx.cancel()
	}

	subspace<P extends TuplePrefix<S["key"]>>(
		prefix: P
	): AsyncTupleTransactionApi<RemoveTupleValuePairPrefix<S, P>> {
		return new AsyncTupleTransactionSubspace(this.tx, [
			...this.subspacePrefix,
			...prefix,
		])
	}
}
