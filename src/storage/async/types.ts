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

export type ReactiveAsyncTupleDatabaseClientArgs = AsyncTupleDatabaseClientArgs & {
	subscribe(args: ScanArgs, callback: Callback): Promise<Unsubscribe>
}
