import { connect, pred } from '../../../../src/index';
import { todoSchema, todos, users, seedTodoData, reassignTodos } from './todo.ts';

export async function runDemoQueries() {
	const client = await connect(todoSchema, { adapter: 'memory' });
	await seedTodoData(client);

	const allTodos = await client.select(todos);

	const pending = await client.select(todos, {
		where: pred.eq((row) => row.status, 'pending'),
		orderBy: (row) => row.title,
	});

	const dueSoon = await client.select(todos, {
		where: pred.gt((row) => row.dueAt ?? 0, Date.now()),
		order: 'asc',
		orderBy: (row) => row.dueAt ?? 0,
		limit: 5,
	});

	await client.update(
		todos,
		pred.and(
			(row) => row.status === 'pending',
			pred.eq((row) => row.ownerId, 1),
		),
		{ status: 'in-progress' }
	);

	await client.delete(todos, (row) => row.status === 'done');

	const allUsers = await client.select(users);
	const aliceId = allUsers.find((u) => u.displayName === 'Alice')?.id;
	const bobId = allUsers.find((u) => u.displayName === 'Bob')?.id;

	let reassigned: Awaited<ReturnType<typeof reassignTodos>> = [];
	if (aliceId && bobId) {
		const bobTodos = await client.select(todos, { where: (row) => row.ownerId === bobId });
		if (bobTodos.length) {
			reassigned = await reassignTodos(client, bobId, aliceId, bobTodos.map((t) => t.id));
		}
	}

	const afterMutations = await client.select(todos, { orderBy: 'updatedAt', order: 'desc' });

	return { allTodos, pending, dueSoon, afterMutations, reassigned };
}
