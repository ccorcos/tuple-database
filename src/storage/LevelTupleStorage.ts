import { AbstractBatch } from "abstract-leveldown"
import { Level } from "level"
import { AsyncTupleStorageApi } from "../database/async/asyncTypes"
import { codec } from "../helpers/codec"

import { KeyValuePair, ScanStorageArgs, WriteOps } from "./types"

export class LevelTupleStorage implements AsyncTupleStorageApi {
	/**
	 * import level from "level"
	 * new LevelTupleStorage(level("path/to.db"))
	 */
	constructor(public db: Level) {}

	async scan(args: ScanStorageArgs = {}): Promise<KeyValuePair[]> {
		const dbArgs: any = {}
		if (args.gt !== undefined) dbArgs.gt = codec.encode(args.gt)
		if (args.gte !== undefined) dbArgs.gte = codec.encode(args.gte)
		if (args.lt !== undefined) dbArgs.lt = codec.encode(args.lt)
		if (args.lte !== undefined) dbArgs.lte = codec.encode(args.lte)
		if (args.limit !== undefined) dbArgs.limit = args.limit
		if (args.reverse !== undefined) dbArgs.reverse = args.reverse

		const results: KeyValuePair[] = []
		for await (const [key, value] of this.db.iterator(dbArgs)) {
			results.push({
				key: codec.decode(key),
				value: codec.decode(value),
			})
		}
		return results
	}

	async commit(writes: WriteOps): Promise<void> {
		const ops = [
			...(writes.remove || []).map(
				(tuple) =>
					({
						type: "del",
						key: codec.encode(tuple),
					} as AbstractBatch)
			),
			...(writes.set || []).map(
				({ key, value }) =>
					({
						type: "put",
						key: codec.encode(key),
						value: codec.encode(value),
					} as AbstractBatch)
			),
		]

		await this.db.batch(ops)
	}

	async close(): Promise<void> {
		return this.db.close()
	}
}
