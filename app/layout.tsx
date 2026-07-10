import type { Metadata } from "next";
import { AppNav } from "@/components/app-nav";
import "./globals.css";

export const metadata: Metadata = {
	title: "Nazava Analytics",
	description: "Server-rendered Shopee analytics intelligence dashboard.",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body>
				<AppNav />
				{children}
			</body>
		</html>
	);
}
