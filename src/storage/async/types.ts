import {
	FilterTupleValuePairByPrefix,
	RemoveTupleValuePairPrefix,
	TuplePrefix,
} from "../typeHelpers"
import {
	Callback,
	ScanArgs,
	ScanStorageArgs,
	Tuple,
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

// Storage + Reactivity + MVCC
export type AsyncTupleDatabaseClientArgs1 = {
	commit(writes: Writes, txId?: TxId): Promise<void>
	cancel(txId: string)
	scan(args: ScanStorageArgs, txId?: TxId): Promise<TupleValuePair[]>
	subscribe(args: ScanStorageArgs, callback: Callback): Promise<Unsubscribe>
}

// Types + ReadApis + Subspace + Transaction
export type AsyncTupleDatabaseDialect<S extends TupleValuePair> = {
	// Types
	commit(writes: Writes<S>, txId?: TxId): Promise<void>
	cancel(txId: string)
	scan<P extends TuplePrefix<S[0]>>(
		args: ScanArgs<P>,
		txId?: TxId
	): Promise<FilterTupleValuePairByPrefix<S, P>[]>
	subscribe<P extends TuplePrefix<S[0]>>(
		args: ScanArgs<P>,
		callback: Callback<FilterTupleValuePairByPrefix<S, P>>
	): Promise<Unsubscribe>

	// ReadApis
	get<T extends S[0]>(
		tuple: T,
		txId?: TxId
	): Promise<FilterTupleValuePairByPrefix<S, T>[1]>
	exists<T extends S[0]>(tuple: T, txId?: TxId): Promise<boolean>

	// Subspace
	subspace<P extends TuplePrefix<S[0]>>(
		prefix: P
	): AsyncTupleDatabaseDialect<RemoveTupleValuePairPrefix<S, P>>

	// Transaction
	transact(): AsyncTupleTransactionApi2<S>
}

export type AsyncTupleTransactionApi2<S extends TupleValuePair> = Pick<
	AsyncTupleDatabaseDialect<S>,
	"get" | "exists" | "scan"
> & {
	// WriteApis
	set<T extends S>(tuple: T[0], value: T[1]): AsyncTupleTransactionApi2<S>
	remove(tuple: S[0]): AsyncTupleTransactionApi2<S>
	write(writes: Writes<S>): AsyncTupleTransactionApi2<S>
	commit(): Promise<void>
	cancel(): Promise<void>

	// Subspace
	subspace<P extends TuplePrefix<S[0]>>(
		prefix: P
	): AsyncTupleTransactionApi2<RemoveTupleValuePairPrefix<S, P>>
}

/** Useful for indicating that a function does not commit any writes. */
export type ReadOnlyAsyncTupleDatabaseApi = {
	get(tuple: Tuple, txId?: TxId): Promise<any>
	exists(tuple: Tuple, txId?: TxId): Promise<boolean>
	scan(args?: ScanArgs, txId?: TxId): Promise<TupleValuePair[]>
}

export type AsyncTupleDatabaseApi = ReadOnlyAsyncTupleDatabaseApi & {
	commit(writes: Writes, txId?: string): Promise<void>
	transact(txId?: string): AsyncTupleTransactionApi
	close(): Promise<void>
	/** Doesn't actually have to be async in the database, just the client. */
	cancel(txId: string): Promise<void>
}

export type ReactiveAsyncTupleDatabaseApi = AsyncTupleDatabaseApi & {
	/** Doesn't actually have to be async in the database, just the client. */
	subscribe(args: ScanArgs, callback: Callback): Promise<Unsubscribe>
}

export type AsyncTupleTransactionApi = ReadOnlyAsyncTupleDatabaseApi & {
	set(tuple: Tuple, value: any): AsyncTupleTransactionApi
	remove(tuple: Tuple): AsyncTupleTransactionApi
	write(writes: Writes): AsyncTupleTransactionApi
	commit(): Promise<void>
	cancel(): Promise<void>
}

/** The methods necessary to create a client in a different process. */
export type AsyncTupleDatabaseClientArgs = ReadOnlyAsyncTupleDatabaseApi & {
	commit(writes: Writes, txId?: string): Promise<void>
	cancel(txId: string): Promise<void>
	close(): Promise<void>
}

export type ReactiveAsyncTupleDatabaseClientArgs =
	AsyncTupleDatabaseClientArgs & {
		subscribe(args: ScanArgs, callback: Callback): Promise<Unsubscribe>
	}
