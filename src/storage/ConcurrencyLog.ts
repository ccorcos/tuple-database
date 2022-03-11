import { mutableFilter } from "../helpers/mutableFilter"
import { Bounds, isTupleWithinBounds } from "../helpers/sortedTupleArray"
import { Tuple } from "./types"

export type TxId = string

type ReadItem = { type: "read"; bounds: Bounds; txId: TxId }
type WriteItem = { type: "write"; tuple: Tuple; txId: TxId | undefined }

type WriteLogItem = ReadItem | WriteItem

export class ConcurrencyLog {
	log: WriteLogItem[] = []

	/** Record a read. */
	read(txId: TxId, bounds: Bounds) {
		this.log.push({ type: "read", txId, bounds })
	}

	/** Add writes to the log only if there is a conflict with a read. */
	write(txId: TxId | undefined, tuple: Tuple) {
		for (const item of this.log) {
			if (item.type === "read" && isTupleWithinBounds(tuple, item.bounds)) {
				this.log.push({ type: "write", tuple, txId })
				break
			}
		}
	}

	/** Determine if any reads conflict with writes. */
	commit(txId: TxId) {
		try {
			const reads: Bounds[] = []
			for (const item of this.log) {
				if (item.type === "read") {
					if (item.txId === txId) {
						reads.push(item.bounds)
					}
				} else if (item.type === "write") {
					for (const read of reads) {
						if (isTupleWithinBounds(item.tuple, read)) {
							throw new Error("Conflicting read/write: " + item.txId)
						}
					}
				}
			}
		} finally {
			this.cleanupReads(txId)
			this.cleanupWrites()
		}
	}

	cancel(txId: TxId) {
		this.cleanupReads(txId)
		this.cleanupWrites()
	}

	/** Cleanup any reads for this transaction. */
	cleanupReads(txId: string) {
		mutableFilter(this.log, (item) => {
			const txRead = item.txId === txId && item.type === "read"
			return !txRead
		})
	}

	/** Cleanup any writes that don't have conflicting reads. */
	cleanupWrites() {
		const reads: Bounds[] = []
		mutableFilter(this.log, (item) => {
			if (item.type === "read") {
				reads.push(item.bounds)
				return true
			} else {
				for (const read of reads) {
					if (isTupleWithinBounds(item.tuple, read)) {
						return true
					}
				}
				return false
			}
		})
	}
}
