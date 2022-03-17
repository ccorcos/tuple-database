/*

This file is generated from async/asyncTypes.ts

*/

type Identity<T> = T

import {
	FilterTupleValuePairByPrefix,
	RemoveTupleValuePairPrefix,
	TuplePrefix,
} from "../typeHelpers"
import {
	Callback,
	ScanArgs,
	ScanStorageArgs,
	TupleValuePair,
	TxId,
	Unsubscribe,
	Writes,
} from "../types"

/** The low-level API for implementing new storage layers. */
export type TupleStorageApi = {
	scan: (args: ScanStorageArgs) => Identity<TupleValuePair[]>
	commit: (writes: Writes) => Identity<void>
	close: () => Identity<void>
}

/** Wraps TupleStorageApi with reactivity and MVCC */
export type TupleDatabaseApi = {
	scan: (args: ScanStorageArgs, txId?: TxId) => Identity<TupleValuePair[]>
	commit: (writes: Writes, txId?: TxId) => Identity<void>
	cancel: (txId: string) => Identity<void>
	subscribe: (
		args: ScanStorageArgs,
		callback: Callback
	) => Identity<Unsubscribe>
	close: () => Identity<void>
}

/** Wraps TupleDatabaseApi with types, subspaces, transaction objects, and additional read apis.  */
export type TupleDatabaseDialectApi<S extends TupleValuePair = TupleValuePair> =
	{
		// Types
		commit: (writes: Writes<S>, txId?: TxId) => Identity<void>
		cancel: (txId: string) => Identity<void>
		scan: <P extends TuplePrefix<S[0]>>(
			args?: ScanArgs<P>,
			txId?: TxId
		) => Identity<FilterTupleValuePairByPrefix<S, P>[]>
		subscribe: <P extends TuplePrefix<S[0]>>(
			args: ScanArgs<P>,
			callback: Callback<FilterTupleValuePairByPrefix<S, P>>
		) => Identity<Unsubscribe>
		close: () => Identity<void>

		// ReadApis
		get: <T extends S[0]>(
			tuple: T,
			txId?: TxId
		) => Identity<FilterTupleValuePairByPrefix<S, T>[1]>
		exists: <T extends S[0]>(tuple: T, txId?: TxId) => Identity<boolean>

		// Subspace
		subspace: <P extends TuplePrefix<S[0]>>(
			prefix: P
		) => TupleDatabaseDialectApi<RemoveTupleValuePairPrefix<S, P>>

		// Transaction
		transact: (txId?: TxId) => TupleTransactionApi<S>
	}

export type TupleTransactionApi<S extends TupleValuePair = TupleValuePair> = {
	// Same as TupleDatabaseDialectApi without the txId argument.
	scan: <P extends TuplePrefix<S[0]>>(
		args?: ScanArgs<P>
	) => Identity<FilterTupleValuePairByPrefix<S, P>[]>
	get: <T extends S[0]>(
		tuple: T
	) => Identity<FilterTupleValuePairByPrefix<S, T>[1]>
	exists: <T extends S[0]>(tuple: T) => Identity<boolean>

	// WriteApis
	set: <T extends S>(tuple: T[0], value: T[1]) => TupleTransactionApi<S>
	remove: (tuple: S[0]) => TupleTransactionApi<S>
	write: (writes: Writes<S>) => TupleTransactionApi<S>
	commit: () => Identity<void>
	cancel: () => Identity<void>

	// Subspace
	subspace: <P extends TuplePrefix<S[0]>>(
		prefix: P
	) => TupleTransactionApi<RemoveTupleValuePairPrefix<S, P>>
}

/** Useful for indicating that a function does not commit any writes. */
// export type ReadOnlyTupleDatabaseApi = {
// 	get(tuple: Tuple, txId?: TxId) => Identity<any>
// 	exists(tuple: Tuple, txId?: TxId): Identity<boolean>
// 	scan(args?: ScanArgs, txId?: TxId): Identity<TupleValuePair[]>
// }
