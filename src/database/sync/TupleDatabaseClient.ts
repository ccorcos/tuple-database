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
	prependPrefixToWriteOps,
	removePrefixFromTuple,
	removePrefixFromTupleValuePairs,
	removePrefixFromWriteOps,
} from "../../helpers/subspaceHelpers"
import { KeyValuePair, Tuple, Value, WriteOps } from "../../storage/types"
import { TupleDatabaseApi } from "../sync/types"
import { ScanArgs, TxId, Unsubscribe } from "../types"
import {
	Callback,
	TupleDatabaseClientApi,
	TupleRootTransactionApi,
	TupleTransactionApi,
} from "./types"

export class TupleDatabaseClient implements TupleDatabaseClientApi {
	constructor(
		private db: TupleDatabaseApi | TupleDatabaseApi,
		public subspacePrefix: Tuple = []
	) {}

	scan(args: ScanArgs = {}, txId?: TxId): Identity<KeyValuePair[]> {
		const storageScanArgs = normalizeSubspaceScanArgs(this.subspacePrefix, args)
		const pairs = this.db.scan(storageScanArgs, txId)
		const result = removePrefixFromTupleValuePairs(this.subspacePrefix, pairs)
		return result as KeyValuePair[]
	}

	subscribe(args: ScanArgs, callback: Callback): Identity<Unsubscribe> {
		const storageScanArgs = normalizeSubspaceScanArgs(this.subspacePrefix, args)
		return this.db.subscribe(storageScanArgs, (write, txId) => {
			return callback(
				removePrefixFromWriteOps(this.subspacePrefix, write) as WriteOps,
				txId
			)
		})
	}

	commit(writes: WriteOps, txId?: TxId): Identity<void> {
		const prefixedWrites = prependPrefixToWriteOps(this.subspacePrefix, writes)
		this.db.commit(prefixedWrites, txId)
	}

	cancel(txId: string) {
		return this.db.cancel(txId)
	}

	get(tuple: Tuple, txId?: TxId): Identity<Value | undefined> {
		// Not sure why these types aren't happy
		// @ts-ignore
		const items = this.scan<T, []>({ gte: tuple, lte: tuple }, txId)
		if (items.length === 0) return
		if (items.length > 1) throw new Error("Get expects only one value.")
		const pair = items[0]
		return pair.value
	}

	exists(tuple: Tuple, txId?: TxId): Identity<boolean> {
		// Not sure why these types aren't happy
		// @ts-ignore
		const items = this.scan({ gte: tuple, lte: tuple }, txId)
		if (items.length === 0) return false
		return items.length >= 1
	}

	// Subspace
	subspace(prefix: Tuple): TupleDatabaseClient {
		const subspacePrefix = [...this.subspacePrefix, ...prefix]
		return new TupleDatabaseClient(this.db, subspacePrefix)
	}

	// Transaction
	transact(txId?: TxId, writes?: WriteOps): TupleRootTransactionApi {
		const id = txId || randomId()
		return new TupleRootTransaction(this.db, this.subspacePrefix, id, writes)
	}

	close() {
		return this.db.close()
	}
}

export class TupleRootTransaction implements TupleRootTransactionApi {
	constructor(
		private db: TupleDatabaseApi | TupleDatabaseApi,
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

	scan(args: ScanArgs = {}): Identity<KeyValuePair[]> {
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

		const pairs = this.db.scan({ ...scanArgs, limit: scanLimit }, this.id)
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

	get(tuple: Tuple): Identity<Value | undefined> {
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
		return pair.value
	}

	exists(tuple: Tuple): Identity<boolean> {
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
	set(tuple: Tuple, value: Value): TupleRootTransactionApi {
		this.checkActive()
		const fullTuple = prependPrefixToTuple(this.subspacePrefix, tuple)
		t.remove(this.writes.remove, fullTuple)
		tv.set(this.writes.set, fullTuple, value)
		return this
	}

	remove(tuple: Tuple): TupleRootTransactionApi {
		this.checkActive()
		const fullTuple = prependPrefixToTuple(this.subspacePrefix, tuple)
		tv.remove(this.writes.set, fullTuple)
		t.set(this.writes.remove, fullTuple)
		return this
	}

	write(writes: WriteOps): TupleRootTransactionApi {
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

	subspace(prefix: Tuple): TupleTransactionApi {
		this.checkActive()
		// TODO: types.
		return new TupleSubspaceTransaction(this as any, prefix)
	}
}

export class TupleSubspaceTransaction implements TupleTransactionApi {
	constructor(private tx: TupleTransactionApi, public subspacePrefix: Tuple) {}

	scan(args: ScanArgs = {}): Identity<KeyValuePair[]> {
		const storageScanArgs = normalizeSubspaceScanArgs(this.subspacePrefix, args)
		const pairs = this.tx.scan(storageScanArgs)
		const result = removePrefixFromTupleValuePairs(this.subspacePrefix, pairs)
		return result as KeyValuePair[]
	}

	get(tuple: Tuple): Identity<Value | undefined> {
		const fullTuple = prependPrefixToTuple(this.subspacePrefix, tuple)
		return this.tx.get(fullTuple)
	}

	exists(tuple: Tuple): Identity<boolean> {
		const fullTuple = prependPrefixToTuple(this.subspacePrefix, tuple)
		return this.tx.exists(fullTuple)
	}

	// ReadApis
	set(tuple: Tuple, value: Value): TupleTransactionApi {
		const fullTuple = prependPrefixToTuple(this.subspacePrefix, tuple)
		this.tx.set(fullTuple, value)
		return this
	}

	remove(tuple: Tuple): TupleTransactionApi {
		const fullTuple = prependPrefixToTuple(this.subspacePrefix, tuple)
		this.tx.remove(fullTuple)
		return this
	}

	write(writes: WriteOps): TupleTransactionApi {
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

	subspace(prefix: Tuple): TupleTransactionApi {
		return new TupleSubspaceTransaction(this.tx, [
			...this.subspacePrefix,
			...prefix,
		])
	}
}
