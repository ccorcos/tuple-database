import { Operation, ScanArgs, Tuple, TupleValuePair, Writes } from "./types"

export interface AsyncReadOnlyTupleStorage {
	get(tuple: Tuple): Promise<any>
	exists(tuple: Tuple): Promise<boolean>
	scan(args?: ScanArgs): Promise<TupleValuePair[]>
}

export type AsyncIndexer = (
	tx: AsyncTransaction,
	op: Operation
) => Promise<void>

export interface AsyncTupleStorage extends AsyncReadOnlyTupleStorage {
	/**
	 * Rename to defineIndex. It's not committing or anything.
	 * And all do this behavior happens in-memory.
	 * But maybe, it should be defined more generically and committed...
	 * that would be ideal as a file-type, but not necessary so long as
	 * we take care of that in our application code...
	 */
	index(indexer: AsyncIndexer): this
	transact(): Promise<AsyncTransaction>
	commit(writes: Writes): Promise<void>
	close(): Promise<void>
}

export interface AsyncTransaction extends AsyncReadOnlyTupleStorage {
	readonly writes: Writes
	set(tuple: Tuple, value: any): this
	remove(tuple: Tuple): this
	write(writes: Writes): this
	commit(): Promise<void>
}
