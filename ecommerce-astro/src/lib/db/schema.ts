import { todoSchema, todos, users, seedTodoData } from './todo.ts';
import { connect } from '../../../../src/runtime.ts';

export const schema = todoSchema;
export const tables = { todos, users };

export async function getClient() {
	const client = await connect(schema);
	await seedTodoData(client);
	return client;
}
