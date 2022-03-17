/*

This file is generated from async/asyncTypes.ts

*/

type Identity<T> = T

import { KeyValuePair, ScanStorageArgs, Writes } from "../../storage/types"
import {
	FilterTupleValuePairByPrefix,
	RemoveTupleValuePairPrefix,
	TuplePrefix,
	ValueForTuple,
} from "../typeHelpers"
import { Callback, ScanArgs, TxId, Unsubscribe } from "../types"

/** The low-level API for implementing new storage layers. */
export type TupleStorageApi = {
	scan: (args?: ScanStorageArgs) => Identity<KeyValuePair[]>
	commit: (writes: Writes) => Identity<void>
	close: () => Identity<void>
}

/** Wraps TupleStorageApi with reactivity and MVCC */
export type TupleDatabaseApi = {
	scan: (args?: ScanStorageArgs, txId?: TxId) => Identity<KeyValuePair[]>
	commit: (writes: Writes, txId?: TxId) => Identity<void>
	cancel: (txId: string) => Identity<void>
	subscribe: (
		args: ScanStorageArgs,
		callback: Callback
	) => Identity<Unsubscribe>
	close: () => Identity<void>
}

/** Wraps TupleDatabaseApi with types, subspaces, transaction objects, and additional read apis.  */
export type TupleDatabaseClientApi<S extends KeyValuePair = KeyValuePair> = {
	cancel: (txId: string) => Identity<void>
	close: () => Identity<void>

	// NOTE: all of these types must have an implicit <T extends S> so that the
	// Database<A | B> can be passed as an argument expecting Database<A>.

	// Types
	commit: (writes: Writes<S>, txId?: TxId) => Identity<void>
	scan: <T extends S, P extends TuplePrefix<T["key"]>>(
		args?: ScanArgs<P>,
		txId?: TxId
	) => Identity<FilterTupleValuePairByPrefix<T, P>[]>
	subscribe: <T extends S, P extends TuplePrefix<T["key"]>>(
		args: ScanArgs<P>,
		callback: Callback<FilterTupleValuePairByPrefix<T, P>>
	) => Identity<Unsubscribe>

	// ReadApis
	get: <T extends S, K extends T["key"]>(
		tuple: K,
		txId?: TxId
	) => Identity<ValueForTuple<T, K> | undefined>
	exists: <T extends S["key"]>(tuple: T, txId?: TxId) => Identity<boolean>

	// Subspace
	subspace: <T extends S, P extends TuplePrefix<T["key"]>>(
		prefix: P
	) => TupleDatabaseClientApi<RemoveTupleValuePairPrefix<T, P>>

	// Transaction
	transact: <T extends S>(txId?: TxId) => TupleTransactionApi<T>
}

export type TupleTransactionApi<S extends KeyValuePair = KeyValuePair> = {
	// Same as TupleDatabaseClientApi without the txId argument.
	scan: <P extends TuplePrefix<S["key"]>>(
		args?: ScanArgs<P>
	) => Identity<FilterTupleValuePairByPrefix<S, P>[]>
	get: <T extends S["key"]>(
		tuple: T
	) => Identity<ValueForTuple<S, T> | undefined>
	exists: <T extends S["key"]>(tuple: T) => Identity<boolean>

	// WriteApis
	set: <T extends S>(
		tuple: T["key"],
		value: T["value"]
	) => TupleTransactionApi<S>
	remove: (tuple: S["key"]) => TupleTransactionApi<S>
	write: (writes: Writes<S>) => TupleTransactionApi<S>
	commit: () => Identity<void>
	cancel: () => Identity<void>

	// Subspace
	subspace: <P extends TuplePrefix<S["key"]>>(
		prefix: P
	) => TupleTransactionApi<RemoveTupleValuePairPrefix<S, P>>
}

/** Useful for indicating that a function does not commit any writes. */
export type ReadOnlyTupleDatabaseClientApi<
	S extends KeyValuePair = KeyValuePair
> = {
	scan: <T extends S, P extends TuplePrefix<T["key"]>>(
		args?: ScanArgs<P>,
		txId?: TxId
	) => Identity<FilterTupleValuePairByPrefix<T, P>[]>
	get: <T extends S, K extends T["key"]>(
		tuple: K,
		txId?: TxId
	) => Identity<ValueForTuple<T, K> | undefined>
	exists: <T extends S["key"]>(tuple: T, txId?: TxId) => Identity<boolean>
	subspace: <T extends S, P extends TuplePrefix<T["key"]>>(
		prefix: P
	) => ReadOnlyTupleDatabaseClientApi<RemoveTupleValuePairPrefix<T, P>>

	// subscribe?
}
