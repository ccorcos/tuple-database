import * as util from "util"

export function indentCascade(lines: Array<string>) {
	return lines.reduce(
		(acc, line, index) => acc + "\n" + indentText(line, index)
	)
}

export function indentText(str: string, depth = 1) {
	return str
		.split("\n")
		.map(line => indent(depth) + line)
		.join("\n")
}

export function indent(n: number) {
	let str = ""
	for (let i = 0; i < n; i++) {
		str += "\t"
	}
	return str
}

export function log(obj: any) {
	return console.log(util.inspect(obj, false, 20))
}

export function getIndentOfLastLine(str: string) {
	const [last] = str.split("\n").slice(-1)
	for (let i = 0; i < (last || "").length; i++) {
		if (last[i] !== "\t") {
			return i
		}
	}
	return 0
}
