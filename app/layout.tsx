import type { Metadata } from "next";
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
			<body>{children}</body>
		</html>
	);
}
