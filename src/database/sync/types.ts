/*

This file is generated from async/asyncTypes.ts

*/

type Identity<T> = T

import {
	KeyValuePair,
	ScanStorageArgs,
	Tuple,
	WriteOps,
} from "../../storage/types"
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
export type TupleDatabaseClientApi = {
	// Types
	commit: (writes: WriteOps, txId?: TxId) => Identity<void>
	cancel: (txId: string) => Identity<void>
	scan: (args?: ScanArgs, txId?: TxId) => Identity<KeyValuePair[]>
	subscribe: (args: ScanArgs, callback: Callback) => Identity<Unsubscribe>
	close: () => Identity<void>

	// ReadApis
	get: (tuple: Tuple, txId?: TxId) => Identity<any | undefined>
	exists: (tuple: Tuple, txId?: TxId) => Identity<boolean>

	// Subspace
	subspace: (prefix: Tuple) => TupleDatabaseClientApi

	// Transaction
	/** Arguments to transact() are for internal use only. */
	transact: (txId?: TxId, writes?: WriteOps) => TupleRootTransactionApi
}

export type TupleRootTransactionApi = {
	// ReadApis
	// Same as TupleDatabaseClientApi without the txId argument.
	scan: (args?: ScanArgs) => Identity<KeyValuePair[]>
	get: (tuple: Tuple) => Identity<any | undefined>
	exists: (tuple: Tuple) => Identity<boolean>

	// Subspace
	// Demotes to a non-root transaction so you cannot commit, cancel, or inspect
	// the transaction.
	subspace: (prefix: Tuple) => TupleTransactionApi

	// WriteApis
	set: (tuple: Tuple, value: any) => TupleRootTransactionApi
	remove: (tuple: Tuple) => TupleRootTransactionApi
	write: (writes: WriteOps) => TupleRootTransactionApi

	// RootTransactionApis
	commit: () => Identity<void>
	cancel: () => Identity<void>
	id: TxId
	writes: Required<WriteOps>
}

export type TupleTransactionApi = {
	// ReadApis
	// Same as TupleDatabaseClientApi without the txId argument.
	scan: (args?: ScanArgs) => Identity<KeyValuePair[]>
	get: (tuple: Tuple) => Identity<any | undefined>
	exists: (tuple: Tuple) => Identity<boolean>

	// Subspace
	subspace: (prefix: Tuple) => TupleTransactionApi

	// WriteApis
	set: (tuple: Tuple, value: any) => TupleTransactionApi
	remove: (tuple: Tuple) => TupleTransactionApi
	write: (writes: WriteOps) => TupleTransactionApi
}

/** Useful for indicating that a function does not commit any writes. */
export type ReadOnlyTupleDatabaseClientApi = {
	scan: (args?: ScanArgs, txId?: TxId) => Identity<KeyValuePair[]>
	get: (tuple: Tuple, txId?: TxId) => Identity<any | undefined>
	exists: (tuple: Tuple, txId?: TxId) => Identity<boolean>
	subspace: (prefix: Tuple) => ReadOnlyTupleDatabaseClientApi
	// subscribe?
}

export type Callback = (writes: WriteOps, txId: TxId) => void | Identity<void>
