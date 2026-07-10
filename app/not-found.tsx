import Link from "next/link";

export default function NotFound() {
	return (
		<main className="shell">
			<section className="panel" style={{ textAlign: "center", padding: "4rem 2rem" }}>
				<h1 className="title" style={{ fontSize: "1.6rem" }}>
					Page not found
				</h1>
				<p className="muted" style={{ margin: "1rem auto", maxWidth: "32rem" }}>
					This section does not exist. Use the navigation above or return to the
					overview.
				</p>
				<Link className="button" href="/">
					Back to overview
				</Link>
			</section>
		</main>
	);
}
