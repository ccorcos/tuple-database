import { MAX, Tuple, TupleScanArgs } from "../storage/types"
import { compareTuple } from "./compareTuple"
import * as sortedList from "./sortedList"

export function set(data: Array<Tuple>, tuple: Tuple) {
	return sortedList.set(data, tuple, compareTuple)
}

export function exists(data: Array<Tuple>, tuple: Tuple) {
	return sortedList.exists(data, tuple, compareTuple)
}

export function remove(data: Array<Tuple>, tuple: Tuple) {
	return sortedList.remove(data, tuple, compareTuple)
}

/**
 * Gets the tuple bounds taking into account any prefix specified.
 */
export function normalizeBounds(args: TupleScanArgs): Bounds {
	let gte: Tuple | undefined
	let gt: Tuple | undefined
	let lte: Tuple | undefined
	let lt: Tuple | undefined

	if (args.gte) {
		if (args.prefix) {
			gte = [...args.prefix, ...args.gte]
		} else {
			gte = [...args.gte]
		}
	} else if (args.gt) {
		if (args.prefix) {
			gt = [...args.prefix, ...args.gt]
		} else {
			gt = [...args.gt]
		}
	} else if (args.prefix) {
		gte = [...args.prefix]
	}

	if (args.lte) {
		if (args.prefix) {
			lte = [...args.prefix, ...args.lte]
		} else {
			lte = [...args.lte]
		}
	} else if (args.lt) {
		if (args.prefix) {
			lt = [...args.prefix, ...args.lt]
		} else {
			lt = [...args.lt]
		}
	} else if (args.prefix) {
		lte = [...args.prefix, MAX]
	}

	return { gte, gt, lte, lt }
}

export type Bounds = {
	/** This prevents developers from accidentally using ScanArgs instead of TupleBounds */
	prefix?: never
	gte?: Tuple
	gt?: Tuple
	lte?: Tuple
	lt?: Tuple
}

export function scan(data: Array<Tuple>, args: TupleScanArgs = {}) {
	const { limit, reverse, ...rest } = args
	const bounds = normalizeBounds(rest)
	return sortedList.scan(data, { limit, reverse, ...bounds }, compareTuple)
}

export function isWithinBounds(tuple: Tuple, bounds: Bounds) {
	if (bounds.gt) {
		if (compareTuple(tuple, bounds.gt) !== 1) {
			return false
		}
	}
	if (bounds.gte) {
		if (compareTuple(tuple, bounds.gte) === -1) {
			return false
		}
	}
	if (bounds.lt) {
		if (compareTuple(tuple, bounds.lt) !== -1) {
			return false
		}
	}
	if (bounds.lte) {
		if (compareTuple(tuple, bounds.lte) === 1) {
			return false
		}
	}
	return true
}
