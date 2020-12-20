export function unreachable(value: never): never {
	throw new Error(`Unreachable: ${JSON.stringify(value)}`)
}
