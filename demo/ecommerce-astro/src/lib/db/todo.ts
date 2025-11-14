import { schema, table, t, index } from '../../../../../src/builders';
import type { DatabaseClient } from '../../../../../src/runtime';
import type { InferSelect } from '../../../../../src/ast';

export const users = table(
  'users',
  {
    id: t.int().primaryKey().identity(),
    email: t.varchar({ length: 256 }).notNull().unique(),
    displayName: t.varchar({ length: 128 }).notNull(),
    role: t.enum(['admin', 'member', 'guest'] as const).default('member'),
    createdAt: t.timestamp({ mode: 'number' }).$defaultFn(() => Date.now()).$onUpdate(() => Date.now()),
  },
  (tbl) => [t.uniqueIndex('users_email_idx').on(tbl.email)]
);

export const todos = table(
  'todos',
  {
    id: t.int().primaryKey().identity(),
    title: t.varchar({ length: 256 }).notNull(),
    description: t.text(),
    status: t.enum(['pending', 'in-progress', 'done'] as const).default('pending'),
    ownerId: t.int().references(() => users.id).notNull(),
    dueAt: t.timestamp({ mode: 'number' }),
    createdAt: t.timestamp({ mode: 'number' }).$defaultFn(() => Date.now()),
    updatedAt: t.timestamp({ mode: 'number' }).$defaultFn(() => Date.now()).$onUpdate(() => Date.now()),
  },
  (tbl) => [index('todos_owner_idx').on(tbl.ownerId), index('todos_status_idx').on(tbl.status)]
);

export const todoSchema = schema({ name: 'todo-dashboard', version: 1 }, { users, todos });

export type Todo = InferSelect<typeof todos>;
export type User = InferSelect<typeof users>;

export async function seedTodoData(client: DatabaseClient<typeof todoSchema>) {
  const existingUsers = await client.select(users);
  if (existingUsers.length) return; // already seeded

  const [alice, bob] = await client.insert(users, [
    { email: 'alice@example.com', displayName: 'Alice', role: 'admin' },
    { email: 'bob@example.com', displayName: 'Bob', role: 'member' },
  ]);

  await client.insert(todos, [
    {
      title: 'Draft onboarding docs',
      description: 'Outline the onboarding flow for new teammates',
      status: 'in-progress',
      ownerId: alice.id,
      dueAt: Date.now() + 1000 * 60 * 60 * 24 * 3,
    },
    {
      title: 'Ship Astro dashboard',
      description: 'Wire up IndexedDB seed data to Astro UI',
      status: 'pending',
      ownerId: bob.id,
    },
  ]);
}

export async function reassignTodos(
  client: DatabaseClient<typeof todoSchema>,
  sourceUserId: number,
  targetUserId: number,
  todoIds: number[]
) {
  if (!todoIds.length) {
    return [] as Todo[];
  }
  const ids = new Set(todoIds);

  return client.transaction([users, todos], async (trx) => {
    const [targetUser] = await trx.select(users, {
      where: (row) => row.id === targetUserId,
      limit: 1,
    });
    if (!targetUser) {
      throw new Error(`Target user ${targetUserId} does not exist`);
    }

    const selected = await trx.select(todos, {
      where: (row) => ids.has(row.id),
    });
    if (selected.length !== ids.size) {
      throw new Error('One or more todos were not found');
    }
    if (selected.some((todo) => todo.ownerId !== sourceUserId)) {
      throw new Error('Todos must currently belong to the source user');
    }

    await trx.update(
      todos,
      (row) => ids.has(row.id),
      { ownerId: targetUserId, status: 'in-progress', updatedAt: Date.now() }
    );

    return trx.select(todos, { where: (row) => ids.has(row.id) });
  });
}
