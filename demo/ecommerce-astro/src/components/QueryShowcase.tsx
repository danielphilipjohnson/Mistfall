import { useEffect, useState } from 'react';
import { runDemoQueries } from '../lib/db/demoQueries';

export default function QueryShowcase() {
	const [data, setData] = useState<Awaited<ReturnType<typeof runDemoQueries>>>();

	useEffect(() => {
		runDemoQueries().then(setData);
	}, []);

	if (!data) return <p>Loading…</p>;

	return (
		<>
			<section>
				<h2>All Todos</h2>
				<pre>{JSON.stringify(data.allTodos, null, 2)}</pre>
			</section>
			<section>
				<h2>Pending (eq/order)</h2>
				<pre>{JSON.stringify(data.pending, null, 2)}</pre>
			</section>
			<section>
				<h2>Due Soon (gt/limit)</h2>
				<pre>{JSON.stringify(data.dueSoon, null, 2)}</pre>
			</section>
			<section>
				<h2>Reassigned (transaction)</h2>
				<pre>{JSON.stringify(data.reassigned, null, 2)}</pre>
			</section>
			<section>
				<h2>After Update/Delete</h2>
				<pre>{JSON.stringify(data.afterMutations, null, 2)}</pre>
			</section>
		</>
	);
}
