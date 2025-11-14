
import { useEffect, useState } from 'react';
import { getClient, tables } from '../lib/db/schema';
import type { Todo } from '../lib/db/todo';

export default function TodoDashboard() {
	const [todos, setTodos] = useState<Todo[]>([]);

	useEffect(() => {
		let active = true;
		getClient().then(async (client) => {
			const rows = await client.select(tables.todos);
			if (active) setTodos(rows);
		});
		return () => {
			active = false;
		};
	}, []);

	return <pre>{JSON.stringify(todos, null, 2)}</pre>;
}