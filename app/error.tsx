"use client";

export default function RootError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	return (
		<main className="shell">
			<section className="panel" style={{ textAlign: "center", padding: "4rem 2rem" }}>
				<h1 className="title" style={{ fontSize: "1.6rem" }}>
					Something went wrong
				</h1>
				<p className="muted" style={{ margin: "1rem auto", maxWidth: "32rem" }}>
					{error.message ||
						"The analytics engine could not complete this request."}
				</p>
				<button className="button" type="button" onClick={reset}>
					Try again
				</button>
			</section>
		</main>
	);
}
