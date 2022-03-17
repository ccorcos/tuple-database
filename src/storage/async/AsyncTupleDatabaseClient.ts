import { randomId } from "../../helpers/randomId"
import * as t from "../../helpers/sortedTupleArray"
import * as tv from "../../helpers/sortedTupleValuePairs"
import {
	normalizeSubspaceScanArgs,
	prependPrefixToTuple,
	prependPrefixToWrites,
	removePrefixFromTuple,
	removePrefixFromTupleValuePairs,
	removePrefixFromWrites,
} from "../../helpers/subspaceHelpers"
import { TupleDatabaseApi } from "../sync/types"
import {
	FilterTupleValuePairByPrefix,
	RemoveTupleValuePairPrefix,
	TuplePrefix,
} from "../typeHelpers"
import {
	Callback,
	ScanArgs,
	Tuple,
	TupleValuePair,
	TxId,
	Unsubscribe,
	Writes,
} from "../types"
import {
	AsyncTupleDatabaseApi,
	AsyncTupleDatabaseClientApi,
	AsyncTupleTransactionApi,
} from "./asyncTypes"

export class AsyncTupleDatabaseClient<S extends TupleValuePair>
	implements AsyncTupleDatabaseClientApi<S>
{
	constructor(
		private db: AsyncTupleDatabaseApi | TupleDatabaseApi,
		public subspacePrefix: Tuple = []
	) {}

	async scan<P extends TuplePrefix<S[0]>>(
		args: ScanArgs<P> = {},
		txId?: TxId
	): Promise<FilterTupleValuePairByPrefix<S, P>[]> {
		const storageScanArgs = normalizeSubspaceScanArgs(this.subspacePrefix, args)
		const pairs = await this.db.scan(storageScanArgs, txId)
		const result = removePrefixFromTupleValuePairs(this.subspacePrefix, pairs)
		return result as FilterTupleValuePairByPrefix<S, P>[]
	}

	async subscribe<P extends TuplePrefix<S[0]>>(
		args: ScanArgs<P>,
		callback: Callback<FilterTupleValuePairByPrefix<S, P>>
	): Promise<Unsubscribe> {
		const storageScanArgs = normalizeSubspaceScanArgs(this.subspacePrefix, args)
		return this.db.subscribe(storageScanArgs, (write) => {
			callback(
				removePrefixFromWrites(this.subspacePrefix, write) as Writes<
					FilterTupleValuePairByPrefix<S, P>
				>
			)
		})
	}

	async commit(writes: Writes<S>, txId?: TxId): Promise<void> {
		const prefixedWrites = prependPrefixToWrites(this.subspacePrefix, writes)
		await this.db.commit(prefixedWrites, txId)
	}

	async cancel(txId: string) {
		return this.db.cancel(txId)
	}

	async get<T extends S[0]>(
		tuple: T,
		txId?: TxId
	): Promise<FilterTupleValuePairByPrefix<S, T>[1]> {
		// Not sure why these types aren't happy
		const items = await this.scan({ gte: tuple, lte: tuple as any }, txId)
		if (items.length === 0) return
		if (items.length > 1) throw new Error("Get expects only one value.")
		const pair = items[0]
		return pair[1]
	}

	async exists<T extends S[0]>(tuple: T, txId?: TxId): Promise<boolean> {
		// Not sure why these types aren't happy
		const items = await this.scan({ gte: tuple, lte: tuple as any }, txId)
		if (items.length === 0) return false
		return items.length >= 1
	}

	// Subspace
	subspace<P extends TuplePrefix<S[0]>>(
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

export class AsyncTupleTransaction<S extends TupleValuePair>
	implements AsyncTupleTransactionApi<S>
{
	constructor(
		private db: AsyncTupleDatabaseApi | TupleDatabaseApi,
		public subspacePrefix: Tuple,
		public id: TxId
	) {}

	committed = false
	canceled = false
	writes: Required<Writes<S>> = { set: [], remove: [] }

	private checkActive() {
		if (this.committed) throw new Error("Transaction already committed")
		if (this.canceled) throw new Error("Transaction already canceled")
	}

	async scan<P extends TuplePrefix<S[0]>>(
		args: ScanArgs<P> = {}
	): Promise<FilterTupleValuePairByPrefix<S, P>[]> {
		this.checkActive()

		const storageScanArgs = normalizeSubspaceScanArgs(this.subspacePrefix, args)
		const pairs = await this.db.scan(storageScanArgs, this.id)
		const result = removePrefixFromTupleValuePairs(this.subspacePrefix, pairs)

		const sets = tv.scan(this.writes.set, storageScanArgs)
		for (const [fullTuple, value] of sets) {
			const tuple = removePrefixFromTuple(this.subspacePrefix, fullTuple)
			tv.set(result, tuple, value)
		}
		const removes = t.scan(this.writes.remove, storageScanArgs)
		for (const fullTuple of removes) {
			const tuple = removePrefixFromTuple(this.subspacePrefix, fullTuple)
			tv.remove(result, tuple)
		}
		return result as FilterTupleValuePairByPrefix<S, P>[]
	}

	async get<T extends S[0]>(
		tuple: T
	): Promise<FilterTupleValuePairByPrefix<S, T>[1]> {
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
		return pair[1]
	}

	async exists<T extends S[0]>(tuple: T): Promise<boolean> {
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
	set<T extends S>(tuple: T[0], value: T[1]): AsyncTupleTransactionApi<S> {
		this.checkActive()
		const fullTuple = prependPrefixToTuple(this.subspacePrefix, tuple)
		t.remove(this.writes.remove, fullTuple)
		tv.set(this.writes.set, fullTuple, value)
		return this
	}

	remove(tuple: S[0]): AsyncTupleTransactionApi<S> {
		this.checkActive()
		const fullTuple = prependPrefixToTuple(this.subspacePrefix, tuple)
		tv.remove(this.writes.set, fullTuple)
		t.set(this.writes.remove, fullTuple)
		return this
	}

	write(writes: Writes<S>): AsyncTupleTransactionApi<S> {
		this.checkActive()

		// If you're calling this function, then the order of these opertions
		// shouldn't matter.
		const { set, remove } = writes
		for (const tuple of remove || []) {
			this.remove(tuple)
		}
		for (const [tuple, value] of set || []) {
			this.set(tuple, value)
		}
		return this
	}

	async commit() {
		this.committed = true
		return this.db.commit(this.writes, this.id)
	}

	async cancel() {
		this.canceled = true
		return this.db.cancel(this.id)
	}

	subspace<P extends TuplePrefix<S[0]>>(
		prefix: P
	): AsyncTupleTransactionApi<RemoveTupleValuePairPrefix<S, P>> {
		// TODO: types.
		return new AsyncTupleTransactionSubspace(this as any, prefix)
	}
}

export class AsyncTupleTransactionSubspace<S extends TupleValuePair>
	implements AsyncTupleTransactionApi<S>
{
	constructor(
		private tx: AsyncTupleTransactionApi<any>,
		public subspacePrefix: Tuple
	) {}

	async scan<P extends TuplePrefix<S[0]>>(
		args: ScanArgs<P> = {}
	): Promise<FilterTupleValuePairByPrefix<S, P>[]> {
		const storageScanArgs = normalizeSubspaceScanArgs(this.subspacePrefix, args)
		return this.tx.scan(storageScanArgs)
	}

	async get<T extends S[0]>(
		tuple: T
	): Promise<FilterTupleValuePairByPrefix<S, T>[1]> {
		const fullTuple = prependPrefixToTuple(this.subspacePrefix, tuple)
		return this.tx.get(fullTuple)
	}

	async exists<T extends S[0]>(tuple: T): Promise<boolean> {
		const fullTuple = prependPrefixToTuple(this.subspacePrefix, tuple)
		return this.tx.exists(fullTuple)
	}

	// ReadApis
	set<T extends S>(tuple: T[0], value: T[1]): AsyncTupleTransactionApi<S> {
		const fullTuple = prependPrefixToTuple(this.subspacePrefix, tuple)
		this.tx.set(fullTuple, value)
		return this
	}

	remove(tuple: S[0]): AsyncTupleTransactionApi<S> {
		const fullTuple = prependPrefixToTuple(this.subspacePrefix, tuple)
		this.tx.remove(fullTuple)
		return this
	}

	write(writes: Writes<S>): AsyncTupleTransactionApi<S> {
		// If you're calling this function, then the order of these opertions
		// shouldn't matter.
		const { set, remove } = writes
		for (const tuple of remove || []) {
			this.remove(tuple)
		}
		for (const [tuple, value] of set || []) {
			this.set(tuple, value)
		}
		return this
	}

	async commit() {
		return this.tx.commit()
	}

	async cancel() {
		return this.tx.cancel()
	}

	subspace<P extends TuplePrefix<S[0]>>(
		prefix: P
	): AsyncTupleTransactionApi<RemoveTupleValuePairPrefix<S, P>> {
		return new AsyncTupleTransactionSubspace(this.tx, [
			...this.subspacePrefix,
			...prefix,
		])
	}
}
