import {
	KeyValuePair,
	ScanStorageArgs,
	Tuple,
	WriteOps,
} from "../../storage/types"
import { ScanArgs, TxId, Unsubscribe } from "../types"

/** The low-level API for implementing new storage layers. */
export type AsyncTupleStorageApi = {
	scan: (args?: ScanStorageArgs) => Promise<KeyValuePair[]>
	commit: (writes: WriteOps) => Promise<void>
	close: () => Promise<void>
}

/** Wraps AsyncTupleStorageApi with reactivity and MVCC */
export type AsyncTupleDatabaseApi = {
	scan: (args?: ScanStorageArgs, txId?: TxId) => Promise<KeyValuePair[]>
	commit: (writes: WriteOps, txId?: TxId) => Promise<void>
	cancel: (txId: string) => Promise<void>
	subscribe: (
		args: ScanStorageArgs,
		callback: AsyncCallback
	) => Promise<Unsubscribe>
	close: () => Promise<void>
}

/** Wraps AsyncTupleDatabaseApi with types, subspaces, transaction objects, and additional read apis.  */
export type AsyncTupleDatabaseClientApi = {
	// Types
	commit: (writes: WriteOps, txId?: TxId) => Promise<void>
	cancel: (txId: string) => Promise<void>
	scan: (args?: ScanArgs, txId?: TxId) => Promise<KeyValuePair[]>
	subscribe: (args: ScanArgs, callback: AsyncCallback) => Promise<Unsubscribe>
	close: () => Promise<void>

	// ReadApis
	get: (tuple: Tuple, txId?: TxId) => Promise<any | undefined>
	exists: (tuple: Tuple, txId?: TxId) => Promise<boolean>

	// Subspace
	subspace: (prefix: Tuple) => AsyncTupleDatabaseClientApi

	// Transaction
	/** Arguments to transact() are for internal use only. */
	transact: (txId?: TxId, writes?: WriteOps) => AsyncTupleRootTransactionApi
}

export type AsyncTupleRootTransactionApi = {
	// ReadApis
	// Same as AsyncTupleDatabaseClientApi without the txId argument.
	scan: (args?: ScanArgs) => Promise<KeyValuePair[]>
	get: (tuple: Tuple) => Promise<any | undefined>
	exists: (tuple: Tuple) => Promise<boolean>

	// Subspace
	// Demotes to a non-root transaction so you cannot commit, cancel, or inspect
	// the transaction.
	subspace: (prefix: Tuple) => AsyncTupleTransactionApi

	// WriteApis
	set: (tuple: Tuple, value: any) => AsyncTupleRootTransactionApi
	remove: (tuple: Tuple) => AsyncTupleRootTransactionApi
	write: (writes: WriteOps) => AsyncTupleRootTransactionApi

	// RootTransactionApis
	commit: () => Promise<void>
	cancel: () => Promise<void>
	id: TxId
	writes: Required<WriteOps>
}

export type AsyncTupleTransactionApi = {
	// ReadApis
	// Same as AsyncTupleDatabaseClientApi without the txId argument.
	scan: (args?: ScanArgs) => Promise<KeyValuePair[]>
	get: (tuple: Tuple) => Promise<any | undefined>
	exists: (tuple: Tuple) => Promise<boolean>

	// Subspace
	subspace: (prefix: Tuple) => AsyncTupleTransactionApi

	// WriteApis
	set: (tuple: Tuple, value: any) => AsyncTupleTransactionApi
	remove: (tuple: Tuple) => AsyncTupleTransactionApi
	write: (writes: WriteOps) => AsyncTupleTransactionApi
}

/** Useful for indicating that a function does not commit any writes. */
export type ReadOnlyAsyncTupleDatabaseClientApi = {
	scan: (args?: ScanArgs, txId?: TxId) => Promise<KeyValuePair[]>
	get: (tuple: Tuple, txId?: TxId) => Promise<any | undefined>
	exists: (tuple: Tuple, txId?: TxId) => Promise<boolean>
	subspace: (prefix: Tuple) => ReadOnlyAsyncTupleDatabaseClientApi
	// subscribe?
}

export type AsyncCallback = (
	writes: WriteOps,
	txId: TxId
) => void | Promise<void>
