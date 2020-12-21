const { FileStorage } = require("../build/database/FileStorage")
const { ReactiveStorage } = require("../build/database/ReactiveStorage")

const dbPath = __dirname + "/example.txt"
const db = new ReactiveStorage(new FileStorage(dbPath))

// =========================================================================

const ReactDOM = require("react-dom")
const React = require("react")
const { useEffect } = require("react")

const h = React.createElement

function useSubscribe(index, args) {
	const [state, setState] = React.useState([])

	useEffect(() => {
		const [result, unsubscribe] = db.subscribe(index, args, (updates) => {
			// TODO: use the updates argument to compute update rather than run the
			// scan all over again.
			setState(db.scan(index, args))
		})
		setState(result)
		return unsubscribe
	}, [index]) // TODO: use arg here too, but we need

	return state
}

function App() {
	const handleClick = React.useCallback(() => {
		const todo = {
			id: Math.random(),
			time: Date.now(),
			title: "",
			completed: false,
		}
		db.transact().set("todos", [-todo.time, todo]).commit()
	}, [])

	const todos = useSubscribe("todos", {}).map(([time, todo]) => todo)

	return h(
		"div",
		{ style: { margin: "3em auto", maxWidth: "20em" } },
		h(
			"button",
			{ onClick: handleClick, style: { margin: "1em 1.5em" } },
			"New To-do"
		),
		...todos.map((todo) => {
			const onChange = (e) => {
				db.transact()
					.remove("todos", [-todo.time, todo])
					.set("todos", [-todo.time, { ...todo, title: e.target.value }])
					.commit()
			}

			const onToggle = (e) => {
				db.transact()
					.remove("todos", [-todo.time, todo])
					.set("todos", [-todo.time, { ...todo, completed: !todo.completed }])
					.commit()
			}

			const onDelete = (e) => {
				db.transact().remove("todos", [-todo.time, todo]).commit()
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
