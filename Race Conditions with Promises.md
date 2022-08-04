

There's a fundamental issue with Promises not being eager and managing async race conditions.

Imagine an example where you have some async storage. In this case, its just a variable `data`, but `read` and `write` are marked `async` so they will return a Promise.

Subscribe intends to read the data and add a listener *at the same time* and is forced to deal with the async read.

```ts
// const storage = {
// 	data: 0,
// 	async read() {
// 		return this.data
// 	}
// 	async write(n) {
// 		this.data = n
// 	}
// }

let data = 0
let listeners = new Set()

async function read() {
	return data
}
async function write(n) {
	data = n
	listeners.forEach(fn => fn(data))
}

async function subscribe1(fn) {
	listeners.add(fn)
	return await read()
}

async function subscribe2(fn) {
	const result = await read()
	listeners.add(fn)
	return result
}

async function main() {
	subscribe1(() => console.log("update1", data)).then((d) => console.log("subscribe1", d, data))
	subscribe2(() => console.log("update2", data)).then((d) => console.log("subscribe2", d, data))
	write(1)
}

// update1 1
// update1 2
// update2 2
// subscribe1 0 2
// subscribe2 0 2

// > update 1
// > subscribed 0 1
```