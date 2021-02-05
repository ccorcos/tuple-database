import { chunk } from "lodash"
import * as uuid from "uuid"
import md5 from "md5"

export function randomId(seed?: string): string {
	if (seed) {
		const hexStr = md5(seed)
		const bytes = chunk(hexStr, 2).map((chars) => parseInt(chars.join(""), 16))
		return uuid.v4({ random: bytes })
	} else {
		return uuid.v4()
	}
}

// Trying to use this symbol so we don't have issues with instanceof across
// the main/renderer electron bridge.
export const idSymbol = Symbol("isId")

export function isId(value: any): value is Id {
	// return value instanceof Id
	return Boolean(value[idSymbol])
}

export class Id {
	[idSymbol] = true

	public uuid: string
	constructor(uuid?: string) {
		if (uuid === undefined) {
			this.uuid = randomId()
		} else {
			this.uuid = uuid
		}
	}

	toString() {
		return `[Id ${this.uuid}]`
	}

	static from(uuid: string) {
		return new Id(uuid)
	}
	static isEqual(a: Id, b: Id) {
		if (isId(a) && isId(b)) {
			return a.uuid === b.uuid
		} else {
			return false
		}
	}
}
