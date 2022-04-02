export function waitForValues(values: any[]): any {
	if (values.some((value) => value instanceof Promise))
		return Promise.all(values)
	else return values
}
