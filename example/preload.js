const { FileStorage } = require("../build/database/FileStorage")
const { ReactiveStorage } = require("../build/database/ReactiveStorage")
const { MIN, MAX } = require("../build/database/types")
const _ = require("lodash")

const dbPath = __dirname + "/example.db"
const db = new ReactiveStorage(new FileStorage(dbPath))

// =========================================================================

const ReactDOM = require("react-dom")
const React = require("react")
const { useEffect, useMemo, useCallback } = require("react")

const h = React.createElement

function useDeepEqual(obj) {
	const prev = React.useRef()
	React.useEffect(() => {
		prev.current = obj
	}, [obj])

	const same = _.isEqual(prev.current, obj)
	const id = React.useRef(Math.random())
	if (same) {
		return id.current
	} else {
		id.current = Math.random()
		return id.current
	}
}

function useSubscribe(index, args) {
	const [state, setState] = React.useState([])

	const argsDep = useDeepEqual(args)

	useEffect(() => {
		const [result, unsubscribe] = db.subscribe(index, args, (updates) => {
			// TODO: use the updates argument to compute update rather than run the
			// scan all over again.
			setState(db.scan(index, args))
		})
		setState(result)
		return unsubscribe
	}, [index, argsDep])

	return state
}

// Write to both indexes.
function writeTodo(todo) {
	db.transact()
		.set("todos", [-todo.time, todo])
		.set("todos-complete", [todo.completed, -todo.time, todo])
		.commit()
}

// TODO: compose together write and remove logic.
function updateTodo(oldTodo, todo) {
	db.transact()
		.remove("todos", [-oldTodo.time, oldTodo])
		.remove("todos-complete", [oldTodo.completed, -oldTodo.time, oldTodo])
		.set("todos", [-todo.time, todo])
		.set("todos-complete", [todo.completed, -todo.time, todo])
		.commit()
}

function deleteTodo(oldTodo) {
	db.transact()
		.remove("todos", [-oldTodo.time, oldTodo])
		.remove("todos-complete", [oldTodo.completed, -oldTodo.time, oldTodo])
		.commit()
}

function App() {
	const handleClick = React.useCallback(() => {
		const todo = {
			id: Math.random(),
			time: Date.now(),
			title: "",
			completed: false,
		}
		writeTodo(todo)
	}, [])

	const [state, setState] = React.useState("all") // "all" | "completed" | "not-completed"

	const onChangeFilter = useCallback((e) => {
		setState(e.target.value)
	}, [])

	const index = state === "all" ? "todos" : "todos-complete"
	const args =
		state === "all"
			? {}
			: state === "completed"
			? { gte: [true, MIN], lte: [true, MAX] }
			: { gte: [false, MIN], lte: [false, MAX] }

	const todos = useSubscribe(index, args).map(
		(tuple) => tuple[tuple.length - 1]
	)

	return h(
		"div",
		{ style: { margin: "3em auto", maxWidth: "20em" } },
		h(
			"button",
			{ onClick: handleClick, style: { margin: "1em 1.5em" } },
			"New To-do"
		),

		// Filters
		h(
			"div",
			{},
			h("input", {
				type: "radio",
				value: "all",
				checked: state === "all",
				onChange: onChangeFilter,
			}),
			"All"
		),

		h(
			"div",
			{},
			h("input", {
				type: "radio",
				value: "completed",
				checked: state === "completed",
				onChange: onChangeFilter,
			}),
			"Completed"
		),

		h(
			"div",
			{ style: { marginBottom: "1em" } },
			h("input", {
				type: "radio",
				value: "not-completed",
				checked: state === "not-completed",
				onChange: onChangeFilter,
			}),
			"Not Completed"
		),

		...todos.map((todo) => {
			const onChange = (e) => {
				updateTodo(todo, { ...todo, title: e.target.value })
			}

			const onToggle = (e) => {
				updateTodo(todo, { ...todo, completed: !todo.completed })
			}

			const onDelete = (e) => {
				deleteTodo(todo)
			}

			return h(
				"div",
				{ key: todo.id },
				h("input", {
					type: "checkbox",
					checked: todo.completed,
					onChange: onToggle,
				}),
				h("input", { value: todo.title, onChange }),
				h("button", { onClick: onDelete, style: { marginLeft: "0.5em" } }, "x")
			)
		})
	)
}

// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
window.addEventListener("DOMContentLoaded", () => {
	const div = document.getElementById("root")

	ReactDOM.render(h(App), div)
})
