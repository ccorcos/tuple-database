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
export type AsyncTupleStorageApi = {
	scan(args: ScanStorageArgs): Promise<TupleValuePair[]>
	commit(writes: Writes): Promise<void>
	close(): Promise<void>
}

/** Wraps AsyncTupleStorageApi with reactivity and MVCC */
export type AsyncTupleDatabaseApi = {
	scan(args: ScanStorageArgs, txId?: TxId): Promise<TupleValuePair[]>
	commit(writes: Writes, txId?: TxId): Promise<void>
	cancel(txId: string)
	subscribe(args: ScanStorageArgs, callback: Callback): Promise<Unsubscribe>
	close(): Promise<void>
}

/** Wraps AsyncTupleDatabaseApi with types, subspaces, transaction objects, and additional read apis.  */
export type AsyncTupleDatabaseDialectApi<
	S extends TupleValuePair = TupleValuePair
> = {
	// Types
	commit(writes: Writes<S>, txId?: TxId): Promise<void>
	cancel(txId: string)
	scan<P extends TuplePrefix<S[0]>>(
		args?: ScanArgs<P>,
		txId?: TxId
	): Promise<FilterTupleValuePairByPrefix<S, P>[]>
	subscribe<P extends TuplePrefix<S[0]>>(
		args: ScanArgs<P>,
		callback: Callback<FilterTupleValuePairByPrefix<S, P>>
	): Promise<Unsubscribe>
	close(): Promise<void>

	// ReadApis
	get<T extends S[0]>(
		tuple: T,
		txId?: TxId
	): Promise<FilterTupleValuePairByPrefix<S, T>[1]>
	exists<T extends S[0]>(tuple: T, txId?: TxId): Promise<boolean>

	// Subspace
	subspace<P extends TuplePrefix<S[0]>>(
		prefix: P
	): AsyncTupleDatabaseDialectApi<RemoveTupleValuePairPrefix<S, P>>

	// Transaction
	transact(txId?: TxId): AsyncTupleTransactionApi<S>
}

export type AsyncTupleTransactionApi<
	S extends TupleValuePair = TupleValuePair
> = {
	// Same as AsyncTupleDatabaseDialectApi without the txId argument.
	scan<P extends TuplePrefix<S[0]>>(
		args?: ScanArgs<P>
	): Promise<FilterTupleValuePairByPrefix<S, P>[]>
	get<T extends S[0]>(tuple: T): Promise<FilterTupleValuePairByPrefix<S, T>[1]>
	exists<T extends S[0]>(tuple: T): Promise<boolean>

	// WriteApis
	set<T extends S>(tuple: T[0], value: T[1]): AsyncTupleTransactionApi<S>
	remove(tuple: S[0]): AsyncTupleTransactionApi<S>
	write(writes: Writes<S>): AsyncTupleTransactionApi<S>
	commit(): Promise<void>
	cancel(): Promise<void>

	// Subspace
	subspace<P extends TuplePrefix<S[0]>>(
		prefix: P
	): AsyncTupleTransactionApi<RemoveTupleValuePairPrefix<S, P>>
}

/** Useful for indicating that a function does not commit any writes. */
// export type ReadOnlyAsyncTupleDatabaseApi = {
// 	get(tuple: Tuple, txId?: TxId): Promise<any>
// 	exists(tuple: Tuple, txId?: TxId): Promise<boolean>
// 	scan(args?: ScanArgs, txId?: TxId): Promise<TupleValuePair[]>
// }

// /** The methods necessary to create a client in a different process. */
// export type AsyncTupleDatabaseClientArgs = ReadOnlyAsyncTupleDatabaseApi & {
// 	commit(writes: Writes, txId?: string): Promise<void>
// 	cancel(txId: string): Promise<void>
// 	close(): Promise<void>
// }

// export type ReactiveAsyncTupleDatabaseClientArgs =
// 	AsyncTupleDatabaseClientArgs & {
// 		subscribe(args: ScanArgs, callback: Callback): Promise<Unsubscribe>
// 	}
