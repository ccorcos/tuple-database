/*

This file is generated from async/asyncTypes.ts

*/

type Identity<T> = T

import { KeyValuePair, ScanStorageArgs, WriteOps } from "../../storage/types"
import {
	FilterTupleValuePairByPrefix,
	RemoveTupleValuePairPrefix,
	TuplePrefix,
	ValueForTuple,
} from "../typeHelpers"
import { ScanArgs, TxId, Unsubscribe } from "../types"

/** The low-level API for implementing new storage layers. */
export type TupleStorageApi = {
	scan: (args?: ScanStorageArgs) => Identity<KeyValuePair[]>
	commit: (writes: WriteOps) => Identity<void>
	close: () => Identity<void>
}

/** Wraps TupleStorageApi with reactivity and MVCC */
export type TupleDatabaseApi = {
	scan: (args?: ScanStorageArgs, txId?: TxId) => Identity<KeyValuePair[]>
	commit: (writes: WriteOps, txId?: TxId) => Identity<void>
	cancel: (txId: string) => Identity<void>
	subscribe: (
		args: ScanStorageArgs,
		callback: Callback
	) => Identity<Unsubscribe>
	close: () => Identity<void>
}

/** Wraps TupleDatabaseApi with types, subspaces, transaction objects, and additional read apis.  */
export type TupleDatabaseClientApi<S extends KeyValuePair = KeyValuePair> = {
	// Types
	commit: (writes: WriteOps<S>, txId?: TxId) => Identity<void>
	cancel: (txId: string) => Identity<void>
	scan: <T extends S["key"], P extends TuplePrefix<T>>(
		args?: ScanArgs<T, P>,
		txId?: TxId
	) => Identity<FilterTupleValuePairByPrefix<S, P>[]>
	subscribe: <T extends S["key"], P extends TuplePrefix<T>>(
		args: ScanArgs<T, P>,
		callback: Callback<FilterTupleValuePairByPrefix<S, P>>
	) => Identity<Unsubscribe>
	close: () => Identity<void>

	// ReadApis
	get: <T extends S["key"]>(
		tuple: T,
		txId?: TxId
	) => Identity<ValueForTuple<S, T> | undefined>
	exists: <T extends S["key"]>(tuple: T, txId?: TxId) => Identity<boolean>

	// Subspace
	subspace: <P extends TuplePrefix<S["key"]>>(
		prefix: P
	) => TupleDatabaseClientApi<RemoveTupleValuePairPrefix<S, P>>

	// Transaction
	transact: (txId?: TxId) => TupleTransactionApi<S>
}

export type TupleTransactionApi<S extends KeyValuePair = KeyValuePair> = {
	// Same as TupleDatabaseClientApi without the txId argument.
	scan: <T extends S["key"], P extends TuplePrefix<T>>(
		args?: ScanArgs<T, P>
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
	write: (writes: WriteOps<S>) => TupleTransactionApi<S>
	commit: () => Identity<void>
	cancel: () => Identity<void>

	// Subspace
	subspace: <P extends TuplePrefix<S["key"]>>(
		prefix: P
	) => TupleTransactionApi<RemoveTupleValuePairPrefix<S, P>>

	// Transaction
	id: TxId
}

/** Useful for indicating that a function does not commit any writes. */
export type ReadOnlyTupleDatabaseClientApi<
	S extends KeyValuePair = KeyValuePair
> = {
	scan: <T extends S["key"], P extends TuplePrefix<T>>(
		args?: ScanArgs<T, P>,
		txId?: TxId
	) => Identity<FilterTupleValuePairByPrefix<S, P>[]>
	get: <T extends S["key"]>(
		tuple: T,
		txId?: TxId
	) => Identity<ValueForTuple<S, T> | undefined>
	exists: <T extends S["key"]>(tuple: T, txId?: TxId) => Identity<boolean>
	subspace: <P extends TuplePrefix<S["key"]>>(
		prefix: P
	) => ReadOnlyTupleDatabaseClientApi<RemoveTupleValuePairPrefix<S, P>>

	// subscribe?
}

export type Callback<S extends KeyValuePair = KeyValuePair> = (
	writes: WriteOps<S>,
	txId: TxId
) => void | Identity<void>
