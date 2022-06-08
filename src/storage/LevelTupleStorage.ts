import { AbstractBatch } from "abstract-leveldown"
import level from "level"
import { AsyncTupleStorageApi } from "../database/async/asyncTypes"
import {
	decodeTuple,
	decodeValue,
	encodeTuple,
	encodeValue,
} from "../helpers/codec"
import { KeyValuePair, ScanStorageArgs, WriteOps } from "./types"

export class LevelTupleStorage implements AsyncTupleStorageApi {
	/**
	 * import level from "level"
	 * new LevelTupleStorage(level("path/to.db"))
	 */
	constructor(public db: level.LevelDB) {}

	async scan(args: ScanStorageArgs = {}): Promise<KeyValuePair[]> {
		return new Promise((resolve, reject) => {
			const dbArgs: any = {}
			if (args.gt !== undefined) dbArgs.gt = encodeTuple(args.gt)
			if (args.gte !== undefined) dbArgs.gte = encodeTuple(args.gte)
			if (args.lt !== undefined) dbArgs.lt = encodeTuple(args.lt)
			if (args.lte !== undefined) dbArgs.lte = encodeTuple(args.lte)
			if (args.limit !== undefined) dbArgs.limit = args.limit
			if (args.reverse !== undefined) dbArgs.reverse = args.reverse

			const stream = this.db.createReadStream(dbArgs)

			const results: KeyValuePair[] = []
			stream
				.on("data", function (data) {
					results.push({
						key: decodeTuple(data.key),
						value: decodeValue(data.value),
					})
				})
				.on("error", reject)
				.on("close", function () {
					resolve(results)
				})
		})
	}

	async commit(writes: WriteOps): Promise<void> {
		const ops = [
			...(writes.remove || []).map(
				(tuple) =>
					({
						type: "del",
						key: encodeTuple(tuple),
					} as AbstractBatch)
			),
			...(writes.set || []).map(
				({ key, value }) =>
					({
						type: "put",
						key: encodeTuple(key),
						value: encodeValue(value),
					} as AbstractBatch)
			),
		]

		await this.db.batch(ops)
	}

	async close(): Promise<void> {
		return this.db.close()
	}
}
