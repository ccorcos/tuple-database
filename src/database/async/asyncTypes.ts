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
		// Types
		commit: (writes: Writes<S>, txId?: TxId) => Promise<void>
		cancel: (txId: string) => Promise<void>
		scan: <P extends TuplePrefix<S["key"]>>(
			args?: ScanArgs<P>,
			txId?: TxId
		) => Promise<FilterTupleValuePairByPrefix<S, P>[]>
		subscribe: <P extends TuplePrefix<S["key"]>>(
			args: ScanArgs<P>,
			callback: Callback<FilterTupleValuePairByPrefix<S, P>>
		) => Promise<Unsubscribe>
		close: () => Promise<void>

		// ReadApis
		get: <T extends S["key"]>(
			tuple: T,
			txId?: TxId
		) => Promise<ValueForTuple<S, T> | undefined>
		exists: <T extends S["key"]>(tuple: T, txId?: TxId) => Promise<boolean>

		// Subspace
		subspace: <P extends TuplePrefix<S["key"]>>(
			prefix: P
		) => AsyncTupleDatabaseClientApi<RemoveTupleValuePairPrefix<S, P>>

		// Transaction
		transact: (txId?: TxId) => AsyncTupleTransactionApi<S>
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
	scan: <P extends TuplePrefix<S["key"]>>(
		args?: ScanArgs<P>,
		txId?: TxId
	) => Promise<FilterTupleValuePairByPrefix<S, P>[]>
	get: <T extends S["key"]>(
		tuple: T,
		txId?: TxId
	) => Promise<ValueForTuple<S, T> | undefined>
	exists: <T extends S["key"]>(tuple: T, txId?: TxId) => Promise<boolean>
	subspace: <P extends TuplePrefix<S["key"]>>(
		prefix: P
	) => ReadOnlyAsyncTupleDatabaseClientApi<RemoveTupleValuePairPrefix<S, P>>

	// subscribe?
}
