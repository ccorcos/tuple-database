import { ulid } from "ulid"

export class ConflictError extends Error {}

export class KeyValueDatabase {
	private map: { [key: string]: { value: any; version: string } } = {}

	get = (key: string): { value: any; version: string } | undefined => {
		const existing = this.map[key]
		if (existing) return existing
	}

	write(tx: {
		check?: { key: string; version: string }[]
		set?: { key: string; value: any }[]
		delete?: string[]
		sum?: { key: string; value: number }[]
		min?: { key: string; value: number }[]
		max?: { key: string; value: number }[]
	}) {
		const version = ulid()

		for (const { key, version } of tx.check || [])
			if (this.map[key]?.version !== version)
				throw new ConflictError(`Version check failed. ${key} ${version}`)

		for (const { key, value } of tx.set || [])
			this.map[key] = { value, version }

		const replace = (key: string, update: (value?: any) => number) => {
			const existing = this.map[key]
			this.map[key] = { value: update(existing?.value), version }
		}

		for (const { key, value } of tx.sum || [])
			replace(key, (existing) => {
				if (typeof existing === "number") return existing + value
				if (existing === undefined) return value
				console.warn("Calling sum on a non-number value:", key, existing)
				return value
			})
		for (const { key, value } of tx.min || [])
			replace(key, (existing) => {
				if (typeof existing === "number") return Math.min(existing, value)
				if (existing === undefined) return value
				console.warn("Calling min on a non-number value:", key, existing)
				return value
			})
		for (const { key, value } of tx.max || [])
			replace(key, (existing) => {
				if (typeof existing === "number") return Math.max(existing, value)
				if (existing === undefined) return value
				console.warn("Calling max on a non-number value:", key, existing)
				return value
			})

		for (const key of tx.delete || []) delete this.map[key]
	}
}
