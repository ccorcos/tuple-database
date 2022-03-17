/*

This file is generated from async/AsyncTupleDatabaseClient.ts

*/

type Identity<T> = T

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
import {
	Callback,
	ScanArgs,
	Tuple,
	TupleValuePair,
	TxId,
	Unsubscribe,
	Writes,
} from "../../storage/types"
import { TupleDatabaseApi } from "../sync/types"
import {
	FilterTupleValuePairByPrefix,
	RemoveTupleValuePairPrefix,
	TuplePrefix,
	ValueForTuple,
} from "../typeHelpers"
import { TupleDatabaseClientApi, TupleTransactionApi } from "./types"

export class TupleDatabaseClient<S extends TupleValuePair = TupleValuePair>
	implements TupleDatabaseClientApi<S>
{
	constructor(
		private db: TupleDatabaseApi | TupleDatabaseApi,
		public subspacePrefix: Tuple = []
	) {}

	scan<P extends TuplePrefix<S[0]>>(
		args: ScanArgs<P> = {},
		txId?: TxId
	): Identity<FilterTupleValuePairByPrefix<S, P>[]> {
		const storageScanArgs = normalizeSubspaceScanArgs(this.subspacePrefix, args)
		const pairs = this.db.scan(storageScanArgs, txId)
		const result = removePrefixFromTupleValuePairs(this.subspacePrefix, pairs)
		return result as FilterTupleValuePairByPrefix<S, P>[]
	}

	subscribe<P extends TuplePrefix<S[0]>>(
		args: ScanArgs<P>,
		callback: Callback<FilterTupleValuePairByPrefix<S, P>>
	): Identity<Unsubscribe> {
		const storageScanArgs = normalizeSubspaceScanArgs(this.subspacePrefix, args)
		return this.db.subscribe(storageScanArgs, (write) => {
			callback(
				removePrefixFromWrites(this.subspacePrefix, write) as Writes<
					FilterTupleValuePairByPrefix<S, P>
				>
			)
		})
	}

	commit(writes: Writes<S>, txId?: TxId): Identity<void> {
		const prefixedWrites = prependPrefixToWrites(this.subspacePrefix, writes)
		this.db.commit(prefixedWrites, txId)
	}

	cancel(txId: string) {
		return this.db.cancel(txId)
	}

	get<T extends S[0]>(
		tuple: T,
		txId?: TxId
	): Identity<ValueForTuple<S, T> | undefined> {
		// Not sure why these types aren't happy
		const items = this.scan({ gte: tuple, lte: tuple as any }, txId)
		if (items.length === 0) return
		if (items.length > 1) throw new Error("Get expects only one value.")
		const pair = items[0]
		return pair[1]
	}

	exists<T extends S[0]>(tuple: T, txId?: TxId): Identity<boolean> {
		// Not sure why these types aren't happy
		const items = this.scan({ gte: tuple, lte: tuple as any }, txId)
		if (items.length === 0) return false
		return items.length >= 1
	}

	// Subspace
	subspace<P extends TuplePrefix<S[0]>>(
		prefix: P
	): TupleDatabaseClient<RemoveTupleValuePairPrefix<S, P>> {
		const subspacePrefix = [...this.subspacePrefix, ...prefix]
		return new TupleDatabaseClient(this.db, subspacePrefix)
	}

	// Transaction
	transact(txId?: TxId): TupleTransactionApi<S> {
		const id = txId || randomId()
		return new TupleTransaction(this.db, this.subspacePrefix, id)
	}

	close() {
		return this.db.close()
	}
}

export class TupleTransaction<S extends TupleValuePair>
	implements TupleTransactionApi<S>
{
	constructor(
		private db: TupleDatabaseApi | TupleDatabaseApi,
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

	scan<P extends TuplePrefix<S[0]>>(
		args: ScanArgs<P> = {}
	): Identity<FilterTupleValuePairByPrefix<S, P>[]> {
		this.checkActive()

		const storageScanArgs = normalizeSubspaceScanArgs(this.subspacePrefix, args)
		const pairs = this.db.scan(storageScanArgs, this.id)
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

	get<T extends S[0]>(tuple: T): Identity<ValueForTuple<S, T> | undefined> {
		this.checkActive()
		const fullTuple = prependPrefixToTuple(this.subspacePrefix, tuple)

		if (tv.exists(this.writes.set, fullTuple)) {
			// TODO: binary searching twice unnecessarily...
			return tv.get(this.writes.set, fullTuple)
		}
		if (t.exists(this.writes.remove, fullTuple)) {
			return
		}
		const items = this.db.scan({ gte: fullTuple, lte: fullTuple }, this.id)
		if (items.length === 0) return
		if (items.length > 1) throw new Error("Get expects only one value.")
		const pair = items[0]
		return pair[1]
	}

	exists<T extends S[0]>(tuple: T): Identity<boolean> {
		this.checkActive()
		const fullTuple = prependPrefixToTuple(this.subspacePrefix, tuple)

		if (tv.exists(this.writes.set, fullTuple)) {
			return true
		}
		if (t.exists(this.writes.remove, fullTuple)) {
			return false
		}
		const items = this.db.scan({ gte: fullTuple, lte: fullTuple }, this.id)
		if (items.length === 0) return false
		return items.length >= 1
	}

	// ReadApis
	set<T extends S>(tuple: T[0], value: T[1]): TupleTransactionApi<S> {
		this.checkActive()
		const fullTuple = prependPrefixToTuple(this.subspacePrefix, tuple)
		t.remove(this.writes.remove, fullTuple)
		tv.set(this.writes.set, fullTuple, value)
		return this
	}

	remove(tuple: S[0]): TupleTransactionApi<S> {
		this.checkActive()
		const fullTuple = prependPrefixToTuple(this.subspacePrefix, tuple)
		tv.remove(this.writes.set, fullTuple)
		t.set(this.writes.remove, fullTuple)
		return this
	}

	write(writes: Writes<S>): TupleTransactionApi<S> {
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

	commit() {
		this.checkActive()
		this.committed = true
		return this.db.commit(this.writes, this.id)
	}

	cancel() {
		this.checkActive()
		this.canceled = true
		return this.db.cancel(this.id)
	}

	subspace<P extends TuplePrefix<S[0]>>(
		prefix: P
	): TupleTransactionApi<RemoveTupleValuePairPrefix<S, P>> {
		this.checkActive()
		// TODO: types.
		return new TupleTransactionSubspace(this as any, prefix)
	}
}

export class TupleTransactionSubspace<S extends TupleValuePair>
	implements TupleTransactionApi<S>
{
	constructor(
		private tx: TupleTransactionApi<any>,
		public subspacePrefix: Tuple
	) {}

	scan<P extends TuplePrefix<S[0]>>(
		args: ScanArgs<P> = {}
	): Identity<FilterTupleValuePairByPrefix<S, P>[]> {
		const storageScanArgs = normalizeSubspaceScanArgs(this.subspacePrefix, args)
		return this.tx.scan(storageScanArgs)
	}

	get<T extends S[0]>(tuple: T): Identity<ValueForTuple<S, T> | undefined> {
		const fullTuple = prependPrefixToTuple(this.subspacePrefix, tuple)
		return this.tx.get(fullTuple)
	}

	exists<T extends S[0]>(tuple: T): Identity<boolean> {
		const fullTuple = prependPrefixToTuple(this.subspacePrefix, tuple)
		return this.tx.exists(fullTuple)
	}

	// ReadApis
	set<T extends S>(tuple: T[0], value: T[1]): TupleTransactionApi<S> {
		const fullTuple = prependPrefixToTuple(this.subspacePrefix, tuple)
		this.tx.set(fullTuple, value)
		return this
	}

	remove(tuple: S[0]): TupleTransactionApi<S> {
		const fullTuple = prependPrefixToTuple(this.subspacePrefix, tuple)
		this.tx.remove(fullTuple)
		return this
	}

	write(writes: Writes<S>): TupleTransactionApi<S> {
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

	commit() {
		return this.tx.commit()
	}

	cancel() {
		return this.tx.cancel()
	}

	subspace<P extends TuplePrefix<S[0]>>(
		prefix: P
	): TupleTransactionApi<RemoveTupleValuePairPrefix<S, P>> {
		return new TupleTransactionSubspace(this.tx, [
			...this.subspacePrefix,
			...prefix,
		])
	}
}
