import Link from "next/link";
import { UploadCloud } from "lucide-react";
import { dashboardSections } from "@/lib/sections";

export function AppNav() {
	return (
		<header className="nav-shell">
			<Link href="/" className="brand">
				<span className="brand-mark">N</span>
				<span>
					<strong>Nazava Analytics</strong>
					<small>SCU Showdown Web</small>
				</span>
			</Link>
			<nav className="nav-links" aria-label="Dashboard sections">
				<Link href="/">Overview</Link>
				{dashboardSections.map((section) => (
					<Link key={section.slug} href={`/${section.slug}`}>
						{section.title.replace(" Analytics", "").replace("Shopee ", "")}
					</Link>
				))}
			</nav>
			<Link href="/upload" className="header-upload">
				<UploadCloud size={15} /> Upload
			</Link>
		</header>
	);
}
