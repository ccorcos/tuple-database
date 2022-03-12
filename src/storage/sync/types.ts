/*

This file is generated from async/types.ts

*/
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
export type TupleStorageApi = {
	scan(args: ScanStorageArgs): TupleValuePair[]
	commit(writes: Writes): void
	close(): void
}

/** Useful for indicating that a function does not commit any writes. */
export type ReadOnlyTupleDatabaseApi = {
	get(tuple: Tuple, txId?: TxId): any
	exists(tuple: Tuple, txId?: TxId): boolean
	scan(args?: ScanArgs, txId?: TxId): TupleValuePair[]
}

export type TupleDatabaseApi = ReadOnlyTupleDatabaseApi & {
	commit(writes: Writes, txId?: string): void
	transact(txId?: string): TupleTransactionApi
	close(): void
	/** Doesn't actually have to be  in the database, just the client. */
	cancel(txId: string): void
}

export type ReactiveTupleDatabaseApi = TupleDatabaseApi & {
	/** Doesn't actually have to be  in the database, just the client. */
	subscribe(args: ScanArgs, callback: Callback): Unsubscribe
}

export type TupleTransactionApi = ReadOnlyTupleDatabaseApi & {
	set(tuple: Tuple, value: any): TupleTransactionApi
	remove(tuple: Tuple): TupleTransactionApi
	write(writes: Writes): TupleTransactionApi
	commit(): void
	cancel(): void
}

/** The methods necessary to create a client in a different process. */
export type TupleDatabaseClientArgs = ReadOnlyTupleDatabaseApi & {
	commit(writes: Writes, txId?: string): void
	cancel(txId: string): void
	close(): void
}

export type ReactiveTupleDatabaseClientArgs = TupleDatabaseClientArgs & {
	subscribe(args: ScanArgs, callback: Callback): Unsubscribe
}
