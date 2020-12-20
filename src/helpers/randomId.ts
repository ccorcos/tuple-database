import * as _ from "lodash"
import uuidv4 from "uuid/v4"
import md5 from "md5"

export function randomId(str?: string): string {
	if (str) {
		const hexStr = md5(str)
		const bytes = _.chunk(hexStr, 2).map(chars => parseInt(chars.join(""), 16))
		return uuidv4({ random: bytes })
	} else {
		return uuidv4()
	}
}
