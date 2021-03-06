// Please see the README.md for instructions on how to run this example.
const { FileStorage } = require("../build/storage/FileStorage")
const { ReactiveStorage } = require("../build/storage/ReactiveStorage")
const { useSubscribe } = require("../build/react/useSubscribe")
const { MIN, MAX } = require("../build/storage/types")
const _ = require("lodash")

// Initialize a database.
const dbPath = __dirname + "/example.db"
const db = new ReactiveStorage(new FileStorage(dbPath))

// I don't want to setup a whole build system for this example, so I'm going
// to be doing everything here in the preload script so that `require` is available.
const ReactDOM = require("react-dom")
const React = require("react")
const { useCallback, useState } = require("react")

// I don't want to setup and JSX preprocessing, so I'll be doing it the old-school way.
const h = React.createElement

// Write to both indexes.
function writeTodo(tx, todo) {
	tx.set("todos", [-todo.time, todo])
	tx.set("todos-complete", [todo.completed, -todo.time, todo])
}

function deleteTodo(tx, oldTodo) {
	tx.remove("todos", [-oldTodo.time, oldTodo])
	tx.remove("todos-complete", [oldTodo.completed, -oldTodo.time, oldTodo])
}

function updateTodo(tx, oldTodo, todo) {
	deleteTodo(tx, oldTodo)
	writeTodo(tx, todo)
}

function App() {
	// Create a new todo item.
	const handleClick = useCallback(() => {
		const todo = {
			id: Math.random(),
			time: Date.now(),
			title: "",
			completed: false,
		}
		const tx = db.transact()
		writeTodo(tx, todo)
		tx.commit()
	}, [])

	// The todos filter.
	const [filter, setFilter] = useState("all") // "all" | "completed" | "not-completed"

	const onChangeFilter = useCallback((e) => {
		setFilter(e.target.value)
	}, [])

	// Determine which index to use and which scan args to use.
	let index = "todos"
	let args = {}
	if (filter === "completed") {
		index = "todos-complete"
		args = { gte: [true, MIN], lte: [true, MAX] }
	} else if (filter === "not-completed") {
		index = "todos-complete"
		args = { gte: [false, MIN], lte: [false, MAX] }
	}

	// Register the subscription and get the todo object from the last element of the tuple.
	const todos = useSubscribe(db, index, args).map(
		(tuple) => tuple[tuple.length - 1]
	)

	return h(
		"div",
		{ style: { margin: "3em auto", maxWidth: "20em" } },

		// New Todo button.
		h(
			"button",
			{ onClick: handleClick, style: { margin: "1em 1.5em" } },
			"New To-do"
		),

		// Todo Filters
		h(
			"div",
			{},
			h("input", {
				type: "radio",
				value: "all",
				checked: filter === "all",
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
				checked: filter === "completed",
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
				checked: filter === "not-completed",
				onChange: onChangeFilter,
			}),
			"Not Completed"
		),

		// Render the todos.
		...todos.map((todo) => {
			const onChange = (e) => {
				const tx = db.transact()
				updateTodo(tx, todo, { ...todo, title: e.target.value })
				tx.commit()
			}

			const onToggle = (e) => {
				const tx = db.transact()
				updateTodo(tx, todo, { ...todo, completed: !todo.completed })
				tx.commit()
			}

			const onDelete = (e) => {
				const tx = db.transact()
				deleteTodo(tx, todo)
				tx.commit()
			}

			return h(
				"div",
				{ key: todo.id },

				// Completed checkbox.
				h("input", {
					type: "checkbox",
					checked: todo.completed,
					onChange: onToggle,
				}),

				// Todo title input.
				h("input", { value: todo.title, onChange }),

				// Delete todo button.
				h("button", { onClick: onDelete, style: { marginLeft: "0.5em" } }, "x")
			)
		})
	)
}

// Initial render.
window.addEventListener("DOMContentLoaded", () => {
	const div = document.getElementById("root")
	ReactDOM.render(h(App), div)
})
