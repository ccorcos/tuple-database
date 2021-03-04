import {
	Operation,
	ScanArgs,
	Storage,
	Transaction,
	Tuple,
} from "../storage/types"

/**
 * Think of this as a sort of middleware where you can wrap a Storage layer to
 * index additional information.
 */
export class IndexerMiddleware implements Storage {
	constructor(
		private storage: Storage,
		private handler: (tx: Transaction, op: Operation) => void
	) {}

	scan(index: string, args: ScanArgs = {}) {
		return this.storage.scan(index, args)
	}

	transact() {
		const transaction = this.storage.transact()
		return new IndexerTransaction(transaction, this.handler)
	}
}

export class IndexerTransaction implements Transaction {
	constructor(
		private transaction: Transaction,
		private handler: (tx: Transaction, op: Operation) => void
	) {}

	get writes() {
		return this.transaction.writes
	}

	scan(index: string, args: ScanArgs = {}) {
		return this.transaction.scan(index, args)
	}

	commit() {
		return this.transaction.commit()
	}

	set(index: string, tuple: Tuple) {
		this.transaction.set(index, tuple)
		this.handler(this.transaction, { type: "set", index, tuple })
		return this
	}

	remove(index: string, tuple: Tuple) {
		this.transaction.remove(index, tuple)
		this.handler(this.transaction, { type: "remove", index, tuple })
		return this
	}
}
