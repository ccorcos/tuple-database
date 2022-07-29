import { ReadWriteConflictError } from "../../database/ConcurrencyLog"

export async function retryAsync<O>(retries: number, fn: () => Promise<O>) {
	while (true) {
		try {
			const result = await fn()
			return result
		} catch (error) {
			if (retries <= 0) throw error
			const isConflict = error instanceof ReadWriteConflictError
			if (!isConflict) throw error
			retries -= 1
		}
	}
}
