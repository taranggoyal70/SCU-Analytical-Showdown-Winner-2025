# Nazava Analytics

This context defines the language for turning seller-uploaded Shopee exports into a live, auditable analytics workspace.

## Language

**Seller**:
The operator who owns the Shopee exports and uses the analytics workspace to make commercial decisions.
_Avoid_: Dashboard visitor, shopper

**Raw Export**:
An uploaded Shopee CSV or XLSX file preserved privately before normalization.
_Avoid_: Bundled bootstrap CSV, chart data

**Export Family**:
The recognized Shopee report type inferred and validated from a Raw Export's structure.
_Avoid_: File name alone, dashboard section

**Upload Batch**:
A seller-selected set of Raw Exports intended to become one consistent analytics snapshot.
_Avoid_: Individual file, active dataset before validation

**Normalized Artifact**:
A validated, canonical representation derived from one Raw Export for analytics processing.
_Avoid_: Mutated source file, hardcoded metric

**Active Manifest**:
The atomic pointer to the complete valid Upload Batch that all live dashboard requests must read.
_Avoid_: Most recently uploaded file, partial batch

**Bootstrap Dataset**:
The committed competition CSVs used only when no Active Manifest exists in the environment.
_Avoid_: Preferred production source, mock data

**Analytics Section**:
A route-specific decision surface such as traffic, sales, campaigns, products, or income statements.
_Avoid_: Duplicate page with renamed heading

**Filter Window**:
The URL-addressable dataset and date selection applied consistently to server-computed analytics.
_Avoid_: Browser-only state, hidden global filter

**Source Audit**:
Visible evidence of which Export Family, batch, date range, and quality conditions support a metric or recommendation.
_Avoid_: Generic data-source label

**Baseline Model View**:
A forecast, segment, recommendation, or optimizer page whose output is computed by the implemented baseline rather than a trained production model.
_Avoid_: Claim of deployed machine learning

**Upload Session**:
The time-limited, signed HTTP-only authorization to publish an Upload Batch.
_Avoid_: Browser local storage, permanent seller account
