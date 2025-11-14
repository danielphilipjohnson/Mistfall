# Runtime CRUD Demo

Demonstrates `connect`, `insert`, `select`, `update`, and `delete` using the Todo schema.

## Reference File
- `zapping-zero/src/lib/db/demoQueries.ts`

## Example Flow
```ts
const client = await connect(todoSchema, { adapter: 'memory' });
await seedTodoData(client);

const allTodos = await client.select(todos);

await client.update(
  todos,
  (row) => row.status === 'pending' && row.ownerId === 1,
  { status: 'in-progress' }
);

await client.delete(todos, (row) => row.status === 'done');
```
- `connect` opens IndexedDB by default; passing `{ adapter: 'memory' }` keeps data in-memory for demos/tests.
- `select` accepts optional `QueryOptions` (see predicates demo).
- `update`/`delete` accept synchronous predicates that run on each row.

## Try It Yourself
1. Run `npm run dev` inside `zapping-zero` and open the page; the `QueryShowcase` component executes this demo and prints the arrays.
2. Modify the predicates or patch data in `zapping-zero/src/lib/db/demoQueries.ts` and hot-reload the page.
3. Switch to real IndexedDB by removing the `{ adapter: 'memory' }` option.
