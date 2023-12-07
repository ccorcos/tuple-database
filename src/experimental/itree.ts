/*
THIS IS A SEGMENT TREE: https://www.dgp.toronto.edu/public_user/JamesStewart/378notes/22intervals/
Try this: https://www.youtube.com/watch?v=q0QOYtSsTg4


- [ ] diff between avl and red-black tree.
- [ ] generalized search tree. start with a btree for practice?


GiST Required Methods:  insert, delete, search, chooseSubtree, split, and consolidate.





In some sense, intervals are just ordered by containment.

Is it possible to do this with binary search in an ordered list?
x = [10,20]
y = [15,25]
z = [18,22]

[10,15,x]
[15,20,xy]
[18,20,z]
[20,22,z]
[20,25,y]


how does split work?
[10,20,x]
insert [15,25,y]
[10,15,x]
[15,20,xy]
[20,25,y]
insert [18,22,z]




ex2 = [
	[1, 5]
	[1, 6]
	[2, 4]
	[2, 5]
	[3, 8]
	[9, 11]
]


 * listIntervals( k, x )
 *
 * List all the intervals that contain 	 in the subtree rooted at x.
 *
 * This is intitially called as listIntervals( k, root ).


listIntervals( k, x )

  while x != NULL
    output intervals(x)
    if k < separator(x)
      x = left(x)
    else
      x = right(x)
    endif
  endwhile

 * addInterval( I, a, b, min, max, x )
 *
 * The interval to insert is [a,b] and is named I.  We assume that the
 * values a and b separate elementary intervals somewhere in the tree.
 * [min,max] is the span of the current subtree rooted at node x.
 *
 * This is initially called as addInterval( I, a, b, -infinity, +infinity, root ).

addInterval( I, a, b, min, max, x )

  if a <= min and max <= b

    // span(x) is completely within [a,b], so store the interval and stop

    store I in intervals(x)

  else

    // span(x) contains some elementary intervals that aren't in [a,b].
     * We must recurse until we find a subtree that is completely contained
     * in [a,b].  Note that we might recurse into both subtrees.

    if (a < separator(x))
      addInterval( I, a, b, min, separator(x), left(x) );
    endif

    if (separator(x) < b)
      addInterval( I, a, b, separator(x), max, left(x) );
    endif

  endif

*/

export class ConflictError extends Error {}

type IntervalNode = {
	id: string
	intervalIds: string[]

	separator?: number
	leftId?: string
	rightId?: string
}

type IntervalCursor = {
	id: string
	min: number
	max: number
}

type IntervalValue = { id: string; min: number; max: number }

export class IntervalTree {
	private data: { [id: string]: IntervalNode } = {}

	get = (n: number) => {
		const intervalIds: string[] = []

		let node: IntervalNode | undefined = this.data["root"]
		while (node) {
			if (!node) break
			if (node.intervalIds) intervalIds.push(...node.intervalIds)

			if (n < node.separator) {
				node = node.leftId ? this.data[node.leftId] : undefined
			} else {
				node = node.rightId ? this.data[node.rightId] : undefined
			}
		}

		return intervalIds
	}

	overlaps() {}

	write(tx: { set?: IntervalValue[]; delete?: string[] }) {
		for (const interval of tx.set || []) {
			const root = this.data["root"]
			if (!root) {
				this.data["root"] = { id: "root", intervalIds: [interval] }
			}

			if (!root) {
				this.data["root"] = { id: "root", intervalIds: [interval] }
			}
		}

		// const addInterval = (interval: IntervalValue, cursor: IntervalCursor) => {
		// 	if (interval.min <= cursor.min && interval.max >= cursor.max) {
		// 		// interval contains the cursor.
		// 		const node = this.data[cursor.id]
		// 		if (node) node.intervalIds.push(interval.id)
		// 		else
		// 			this.data[cursor.id] = { id: cursor.id, intervalIds: [interval.id] }
		// 		return
		// 	}
		// 	// Overlaps to the left.
		// 	if (interval.min < cursor.node.separator) {
		// 		addInterval(interval, { min: cursor.min, max: cursor.node.separator })
		// 	}
		// }
		// * addInterval( I, a, b, min, max, x )
		//  *
		//  * The interval to insert is [a,b] and is named I.  We assume that the
		//  * values a and b separate elementary intervals somewhere in the tree.
		//  * [min,max] is the span of the current subtree rooted at node x.
		//  *
		//  * This is initially called as addInterval( I, a, b, -infinity, +infinity, root ).
		// addInterval( I, a, b, min, max, x )
		//     // span(x) contains some elementary intervals that aren't in [a,b].
		//      * We must recurse until we find a subtree that is completely contained
		//      * in [a,b].  Note that we might recurse into both subtrees.
		//     if (a < separator(x))
		//       addInterval( I, a, b, min, separator(x), left(x) );
		//     endif
		//     if (separator(x) < b)
		//       addInterval( I, a, b, separator(x), max, left(x) );
		//     endif
	}
}

Math.random().toString(36).slice(2, 10)
