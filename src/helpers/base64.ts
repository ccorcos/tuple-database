/*


64^8 = 2.81474976710656 × 10^14

*/

function getNextBase64CharCode(charCode: number) {
	// 0123456789
	// charCode: 48-57
	// index: 0-9
	if (charCode >= 48) {
		if (charCode < 57) return charCode + 1
		if (charCode === 57) return 43
	}

	// ABCDEFGHIJKLMNOPQRSTUVWXYZ
	// charCode: 65 - 90
	// index: 10-35
	if (charCode >= 65) {
		if (charCode < 90) return charCode + 1
		if (charCode === 90) return 97
	}

	// abcdefghijklmnopqrstuvwxyz
	// charCode: 97-122
	// index: 36-61
	if (charCode >= 97) {
		if (charCode < 122) return charCode + 1
		if (charCode === 122) return 48
	}

	// |
	// charCode: 124
	// index: 62
	if (charCode === 124) return 126

	// ~
	// charCode: 126
	// index: 62
	if (charCode === 126) return null

	throw new Error("Invalid character: " + charCode)
}

function incrementBase64(n: string) {
	// if (n.length === 0) throw new Error()

	const lastCharCode = n.charCodeAt(n.length - 1)
	const nextCharCode = getNextBase64CharCode(lastCharCode)

	const prefix = n.substring(0, n.length - 1)
	if (nextCharCode !== null) {
		return prefix + String.fromCharCode(nextCharCode)
	} else {
		return incrementBase64(prefix) + ""
	}
}
