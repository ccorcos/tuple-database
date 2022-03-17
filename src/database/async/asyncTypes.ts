import { KeyValuePair, ScanStorageArgs, Writes } from "../../storage/types"
import {
	FilterTupleValuePairByPrefix,
	RemoveTupleValuePairPrefix,
	TuplePrefix,
	ValueForTuple,
} from "../typeHelpers"
import { Callback, ScanArgs, TxId, Unsubscribe } from "../types"

/** The low-level API for implementing new storage layers. */
export type AsyncTupleStorageApi = {
	scan: (args?: ScanStorageArgs) => Promise<KeyValuePair[]>
	commit: (writes: Writes) => Promise<void>
	close: () => Promise<void>
}

/** Wraps AsyncTupleStorageApi with reactivity and MVCC */
export type AsyncTupleDatabaseApi = {
	scan: (args?: ScanStorageArgs, txId?: TxId) => Promise<KeyValuePair[]>
	commit: (writes: Writes, txId?: TxId) => Promise<void>
	cancel: (txId: string) => Promise<void>
	subscribe: (args: ScanStorageArgs, callback: Callback) => Promise<Unsubscribe>
	close: () => Promise<void>
}

/** Wraps AsyncTupleDatabaseApi with types, subspaces, transaction objects, and additional read apis.  */
export type AsyncTupleDatabaseClientApi<S extends KeyValuePair = KeyValuePair> =
	{
		cancel: (txId: string) => Promise<void>
		close: () => Promise<void>

		// NOTE: all of these types must have an implicit <T extends S> so that the
		// Database<A | B> can be passed as an argument expecting Database<A>.

		// Types
		commit: (writes: Writes<S>, txId?: TxId) => Promise<void>
		scan: <T extends S, P extends TuplePrefix<T["key"]>>(
			args?: ScanArgs<P>,
			txId?: TxId
		) => Promise<FilterTupleValuePairByPrefix<T, P>[]>
		subscribe: <T extends S, P extends TuplePrefix<T["key"]>>(
			args: ScanArgs<P>,
			callback: Callback<FilterTupleValuePairByPrefix<T, P>>
		) => Promise<Unsubscribe>

		// ReadApis
		get: <T extends S, K extends T["key"]>(
			tuple: K,
			txId?: TxId
		) => Promise<ValueForTuple<T, K> | undefined>
		exists: <T extends S["key"]>(tuple: T, txId?: TxId) => Promise<boolean>

		// Subspace
		subspace: <T extends S, P extends TuplePrefix<T["key"]>>(
			prefix: P
		) => AsyncTupleDatabaseClientApi<RemoveTupleValuePairPrefix<T, P>>

		// Transaction
		transact: <T extends S>(txId?: TxId) => AsyncTupleTransactionApi<T>
	}

export type AsyncTupleTransactionApi<S extends KeyValuePair = KeyValuePair> = {
	// Same as AsyncTupleDatabaseClientApi without the txId argument.
	scan: <P extends TuplePrefix<S["key"]>>(
		args?: ScanArgs<P>
	) => Promise<FilterTupleValuePairByPrefix<S, P>[]>
	get: <T extends S["key"]>(
		tuple: T
	) => Promise<ValueForTuple<S, T> | undefined>
	exists: <T extends S["key"]>(tuple: T) => Promise<boolean>

	// WriteApis
	set: <T extends S>(
		tuple: T["key"],
		value: T["value"]
	) => AsyncTupleTransactionApi<S>
	remove: (tuple: S["key"]) => AsyncTupleTransactionApi<S>
	write: (writes: Writes<S>) => AsyncTupleTransactionApi<S>
	commit: () => Promise<void>
	cancel: () => Promise<void>

	// Subspace
	subspace: <P extends TuplePrefix<S["key"]>>(
		prefix: P
	) => AsyncTupleTransactionApi<RemoveTupleValuePairPrefix<S, P>>
}

/** Useful for indicating that a function does not commit any writes. */
export type ReadOnlyAsyncTupleDatabaseClientApi<
	S extends KeyValuePair = KeyValuePair
> = {
	scan: <T extends S, P extends TuplePrefix<T["key"]>>(
		args?: ScanArgs<P>,
		txId?: TxId
	) => Promise<FilterTupleValuePairByPrefix<T, P>[]>
	get: <T extends S, K extends T["key"]>(
		tuple: K,
		txId?: TxId
	) => Promise<ValueForTuple<T, K> | undefined>
	exists: <T extends S["key"]>(tuple: T, txId?: TxId) => Promise<boolean>
	subspace: <T extends S, P extends TuplePrefix<T["key"]>>(
		prefix: P
	) => ReadOnlyAsyncTupleDatabaseClientApi<RemoveTupleValuePairPrefix<T, P>>

	// subscribe?
}
