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
