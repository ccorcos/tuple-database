import * as _ from "lodash"
import * as uuid from "uuid"
import md5 from "md5"

export function randomId(str?: string): string {
	if (str) {
		const hexStr = md5(str)
		const bytes = _.chunk(hexStr, 2).map((chars) =>
			parseInt(chars.join(""), 16)
		)
		return uuid.v4({ random: bytes })
	} else {
		return uuid.v4()
	}
}
