export class ConflictError extends Error {}

export class KeyValueDatabase {
	private map: { [key: string]: { value; version } } = {}

	get = (key: string): { value: any; version: number } => {
		const existing = this.map[key]
		if (existing) return existing
		return { value: undefined, version: 0 }
	}

	write(tx: {
		check?: { key: string; version: number }[]
		set?: { key: string; value: any }[]
		delete?: string[]
		sum?: { key: string; value: number }[]
		min?: { key: string; value: number }[]
		max?: { key: string; value: number }[]
	}) {
		for (const { key, version } of tx.check || [])
			if (this.map[key]?.version !== version)
				throw new ConflictError(`Version check failed. ${key} ${version}`)

		for (const { key, value } of tx.set || []) {
			const existing = this.map[key]
			if (!existing) {
				this.map[key] = { value, version: 1 }
				continue
			}
			this.map[key] = {
				value,
				version: existing.version + 1,
			}
		}

		const numberOperation = (
			key: string,
			value: number,
			op: (a: number, b: number) => number
		) => {
			const existing = this.map[key]
			if (!existing) {
				this.map[key] = { value, version: 1 }
				return
			}

			let newValue = value
			if (typeof existing.value === "number") {
				newValue = op(value, existing.value)
			} else if (existing.value !== undefined) {
				console.warn("Calling sum on a non-number value:", key, existing.value)
			}

			this.map[key] = {
				value: newValue,
				version: existing.version + 1,
			}
		}

		for (const { key, value } of tx.sum || [])
			numberOperation(key, value, (a, b) => a + b)
		for (const { key, value } of tx.min || [])
			numberOperation(key, value, (a, b) => Math.min(a, b))
		for (const { key, value } of tx.max || [])
			numberOperation(key, value, (a, b) => Math.max(a))

		for (const key of tx.delete || []) {
			const existing = this.map[key]
			if (!existing) continue
			this.map[key] = {
				value: undefined,
				version: existing.version + 1,
			}
		}
	}
}
