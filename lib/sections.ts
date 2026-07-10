export type DashboardSection = {
	slug: string;
	title: string;
	kicker: string;
	description: string;
	datasetIds: string[];
	features: string[];
	mode:
		| "overview"
		| "traffic"
		| "sales"
		| "campaigns"
		| "service"
		| "products"
		| "model"
		| "optimizer";
};

export const dashboardSections: DashboardSection[] = [
	{
		slug: "traffic",
		title: "Traffic Analysis",
		kicker: "Visitor acquisition",
		description:
			"Visitor trends, new vs returning mix, product views, and external channel performance.",
		datasetIds: ["traffic_overview_cleaned", "off_platform_cleaned"],
		features: [
			"Daily/monthly visitor trend",
			"New vs returning visitors",
			"Off-platform channel performance",
			"Visit-to-order conversion funnel",
		],
		mode: "traffic",
	},
	{
		slug: "sales",
		title: "Sales Analysis",
		kicker: "Revenue performance",
		description:
			"Revenue, orders, average order value, voucher impact, and channel-level sales mix.",
		datasetIds: [
			"chat_data_cleaned",
			"flash_sale_cleaned",
			"voucher_cleaned",
			"product_overview_cleaned",
			"shopee_paylater_cleaned",
		],
		features: [
			"Revenue by channel",
			"Orders by channel",
			"Voucher and flash sale contribution",
			"Average order value monitoring",
		],
		mode: "sales",
	},
	{
		slug: "campaigns",
		title: "Campaign Performance",
		kicker: "Marketing analytics",
		description:
			"Flash sales, vouchers, games, and live-stream performance with cost and ROI visibility when available.",
		datasetIds: [
			"flash_sale_cleaned",
			"voucher_cleaned",
			"game_cleaned",
			"live_cleaned",
		],
		features: [
			"Campaign revenue comparison",
			"ROI where cost data exists",
			"Orders by promotion type",
			"Campaign data quality audit",
		],
		mode: "campaigns",
	},
	{
		slug: "customer-service",
		title: "Customer Service Analytics",
		kicker: "Chat and support",
		description:
			"Chat volume, response quality, CSAT, reply rate, mass chat engagement, and chat-to-sales impact.",
		datasetIds: ["chat_data_cleaned", "mass_chat_data_cleaned"],
		features: [
			"CSAT and reply rate",
			"Chat-to-sales contribution",
			"Mass broadcast engagement",
			"Support conversion visibility",
		],
		mode: "service",
	},
	{
		slug: "products",
		title: "Product Analytics",
		kicker: "Catalog and funnel",
		description:
			"Product visitors, page views, add-to-cart behavior, orders, and product sales conversion.",
		datasetIds: ["product_overview_cleaned"],
		features: [
			"Product conversion funnel",
			"Cart and purchase behavior",
			"Product sales trend",
			"Product engagement quality",
		],
		mode: "products",
	},
	{
		slug: "forecast",
		title: "Sales Forecast",
		kicker: "Baseline prediction",
		description:
			"Source-backed revenue trend and lightweight forecast baseline. The old XGBoost notebook remains as reference until retrained in the web runtime.",
		datasetIds: [
			"product_overview_cleaned",
			"traffic_overview_cleaned",
			"flash_sale_cleaned",
			"voucher_cleaned",
		],
		features: [
			"Historical revenue trend",
			"Recent-period forecast baseline",
			"Model-readiness notes",
			"Forecast API compatibility",
		],
		mode: "model",
	},
	{
		slug: "segments",
		title: "Customer Segments",
		kicker: "Audience strategy",
		description:
			"Segment-style customer cohorts derived from traffic, product, and chat behavior until customer-level IDs are available.",
		datasetIds: [
			"chat_data_cleaned",
			"traffic_overview_cleaned",
			"product_overview_cleaned",
		],
		features: [
			"Behavior cohort profiles",
			"Engagement and conversion signals",
			"Marketing actions by segment",
			"Customer-level data gap visibility",
		],
		mode: "model",
	},
	{
		slug: "recommendations",
		title: "Product Recommendations",
		kicker: "Optimization strategy",
		description:
			"Product and campaign recommendations derived from funnel drop-off, sales concentration, and available conversion data.",
		datasetIds: [
			"product_overview_cleaned",
			"flash_sale_cleaned",
			"voucher_cleaned",
		],
		features: [
			"Top-performing product signals",
			"Funnel drop-off opportunities",
			"Bundle and promotion ideas",
			"Pricing optimization inputs",
		],
		mode: "products",
	},
	{
		slug: "campaign-optimizer",
		title: "Campaign ROI Optimizer",
		kicker: "Budget allocation",
		description:
			"Budget allocation view for flash sales, vouchers, games, and live streams using measured revenue/cost fields.",
		datasetIds: [
			"flash_sale_cleaned",
			"voucher_cleaned",
			"game_cleaned",
			"live_cleaned",
		],
		features: [
			"Campaign ROI comparison",
			"Budget allocation guidance",
			"Promotion timing notes",
			"Measured cost caveats",
		],
		mode: "optimizer",
	},
	{
		slug: "automation",
		title: "Automation Bot",
		kicker: "Action command center",
		description:
			"Automation readiness, API actions, and model signals without pretending to execute Shopee-side actions.",
		datasetIds: [
			"chat_data_cleaned",
			"product_overview_cleaned",
			"flash_sale_cleaned",
			"voucher_cleaned",
		],
		features: [
			"Suggested actions log",
			"Available API endpoints",
			"Model-readiness checks",
			"Manual approval workflow",
		],
		mode: "optimizer",
	},
	{
		slug: "mass-chat",
		title: "Mass Chat Broadcasts",
		kicker: "Broadcast engagement",
		description:
			"Recipient, read, click, conversion, order, and sales performance for mass chat campaigns.",
		datasetIds: ["mass_chat_data_cleaned"],
		features: [
			"Broadcast engagement funnel",
			"Read and click rates",
			"Orders from broadcast",
			"Campaign recommendations",
		],
		mode: "service",
	},
	{
		slug: "off-platform",
		title: "Off-Platform Traffic",
		kicker: "External channels",
		description:
			"External traffic, platform/channel performance, cart behavior, and off-platform conversion.",
		datasetIds: ["off_platform_cleaned"],
		features: [
			"Traffic by channel",
			"Platform conversion metrics",
			"Visit-to-cart behavior",
			"External ROI opportunities",
		],
		mode: "traffic",
	},
	{
		slug: "paylater",
		title: "Shopee PayLater",
		kicker: "BNPL performance",
		description:
			"PayLater sales, orders, fee, ROI, and tenor performance using the limited committed PayLater dataset.",
		datasetIds: ["shopee_paylater_cleaned"],
		features: [
			"PayLater sales overview",
			"Tenor performance",
			"Cost vs revenue",
			"Adoption caveats",
		],
		mode: "sales",
	},
	{
		slug: "comparison",
		title: "Period Comparison",
		kicker: "Time-window analysis",
		description:
			"Compare current filtered performance with total available history using URL date filters.",
		datasetIds: [
			"traffic_overview_cleaned",
			"product_overview_cleaned",
			"chat_data_cleaned",
			"flash_sale_cleaned",
		],
		features: [
			"Filtered vs all-time context",
			"Traffic and revenue comparison",
			"Period quality checks",
			"Export-ready API summary",
		],
		mode: "overview",
	},
	{
		slug: "adaptive-learning",
		title: "Adaptive Learning",
		kicker: "Model monitoring",
		description:
			"Model-readiness and retraining queue view. This avoids fake retraining while preserving the old feature concept.",
		datasetIds: [
			"traffic_overview_cleaned",
			"product_overview_cleaned",
			"chat_data_cleaned",
			"flash_sale_cleaned",
		],
		features: [
			"Training data coverage",
			"Retraining readiness",
			"Feature availability",
			"Accuracy caveats",
		],
		mode: "model",
	},
	{
		slug: "spend-optimizer",
		title: "Promotional Spend Optimizer",
		kicker: "ROI scenarios",
		description:
			"Spend allocation and expected return view for measurable campaign datasets.",
		datasetIds: [
			"flash_sale_cleaned",
			"voucher_cleaned",
			"game_cleaned",
			"live_cleaned",
			"shopee_paylater_cleaned",
		],
		features: [
			"Measured ROI by campaign",
			"Budget scenario guidance",
			"Cost data coverage",
			"Optimization recommendations",
		],
		mode: "optimizer",
	},
];

export function getSection(slug: string) {
	return dashboardSections.find((section) => section.slug === slug);
}
