# SnowFlow Industry Test Scenarios
## Retail & Ad/Media

> **Simple instructions. Every feature covered. Child-friendly.**

---

## Quick Reference

| Icon | Meaning |
|------|---------|
| 🟢 | Basic - Anyone can do |
| 🟡 | Intermediate - Some thinking |
| 🔴 | Advanced - Complex flows |
| 👤 | End User test |
| 🛡️ | Admin test |
| ⚡ | Performance test |

---

# PART 1: RETAIL SCENARIOS

## Setup (Do Once)

1. Open browser → `http://localhost:5174`
2. Click **Guided** tab
3. Verify you see "Build Your Agent"
4. Data Source should show **VW_RETAIL_SALES**

---

## SECTION R1: Basic Sales Questions 🟢👤

### R1.1: Total Sales
**What you're testing:** Single Agent + Analyst tool

| Step | Do This | See This |
|------|---------|----------|
| 1 | Set Channel = **Snowflake Intelligence** | Dropdown shows selection |
| 2 | Set Agent = **Single Agent** | Pill highlighted |
| 3 | Click **Test Agent** | Chat opens |
| 4 | Type: `What are the total sales?` | Agent responds with a number |
| 5 | Check response has £ or currency | ✅ Pass |

---

### R1.2: Sales by Region
**What you're testing:** Grouping/aggregation

| Step | Do This | See This |
|------|---------|----------|
| 1 | In chat, type: `Show me sales by region` | Table or list appears |
| 2 | Look for regions: Scotland, London, etc. | Multiple regions shown |
| 3 | Numbers should vary by region | ✅ Pass |

---

### R1.3: Top Products
**What you're testing:** Ranking/sorting

| Step | Do This | See This |
|------|---------|----------|
| 1 | Type: `What are the top 5 products by revenue?` | Ranked list |
| 2 | Should see product names | Names visible |
| 3 | Should be sorted highest→lowest | ✅ Pass |

---

### R1.4: Sales with Date Filter
**What you're testing:** Time filtering

| Step | Do This | See This |
|------|---------|----------|
| 1 | Type: `What were sales last month?` | Number with date context |
| 2 | Type: `Compare to previous month` | Comparison shown |
| 3 | Should mention % change or difference | ✅ Pass |

---

### R1.5: Channel Performance
**What you're testing:** Dimension filtering

| Step | Do This | See This |
|------|---------|----------|
| 1 | Type: `How did online sales compare to in-store?` | Both channels shown |
| 2 | Should see Online and In Store | Two values compared |
| 3 | May show % difference | ✅ Pass |

---

## SECTION R2: Intermediate Analytics 🟡👤

### R2.1: Margin Analysis
**What you're testing:** Calculated metrics

| Step | Do This | See This |
|------|---------|----------|
| 1 | Type: `What is the margin percentage by category?` | Table with categories |
| 2 | Should see Food, Clothing, etc. | Categories listed |
| 3 | Margin % should be between 0-100% | ✅ Pass |

---

### R2.2: Low Margin Alert
**What you're testing:** Threshold analysis

| Step | Do This | See This |
|------|---------|----------|
| 1 | Type: `Which regions have margin below 20%?` | List of regions |
| 2 | Or message saying "none" | Either is valid |
| 3 | If list, all should be <20% | ✅ Pass |

---

### R2.3: Promotion Effectiveness
**What you're testing:** Multi-dimension analysis

| Step | Do This | See This |
|------|---------|----------|
| 1 | Type: `Which promotion types drive the most revenue?` | Promotion types ranked |
| 2 | Should see BOGOF, Discount %, etc. | Types listed |
| 3 | Revenue numbers attached | ✅ Pass |

---

### R2.4: Customer Segment Analysis
**What you're testing:** Segmentation

| Step | Do This | See This |
|------|---------|----------|
| 1 | Type: `What is average order value by customer segment?` | Segments with AOV |
| 2 | Segments: Premium, Standard, etc. | Multiple segments |
| 3 | AOV should differ by segment | ✅ Pass |

---

### R2.5: Loyalty Tier Impact
**What you're testing:** Business metrics

| Step | Do This | See This |
|------|---------|----------|
| 1 | Type: `How does revenue differ by loyalty tier?` | Tiers compared |
| 2 | Gold, Silver, Bronze, None | Tiers listed |
| 3 | Gold should likely be highest | ✅ Pass |

---

## SECTION R3: Advanced Multi-Step 🔴👤

### R3.1: Problem Diagnosis
**What you're testing:** Reasoning + follow-up

| Step | Do This | See This |
|------|---------|----------|
| 1 | Type: `Why did Scotland margin drop?` | Analysis response |
| 2 | Should mention possible causes | Factors listed |
| 3 | Type: `Drill into the Food category specifically` | More detail |
| 4 | Response narrows to Food + Scotland | ✅ Pass |

---

### R3.2: Multi-Metric Dashboard Request
**What you're testing:** Complex queries

| Step | Do This | See This |
|------|---------|----------|
| 1 | Type: `Give me a summary: total sales, margin %, top store, top product` | Multiple metrics |
| 2 | Should see 4+ data points | All requested items |
| 3 | Data should be coherent | ✅ Pass |

---

### R3.3: Trend Analysis
**What you're testing:** Time series

| Step | Do This | See This |
|------|---------|----------|
| 1 | Type: `Show sales trend over the last 6 months` | Trend data |
| 2 | Should see monthly breakdown | Months listed |
| 3 | Can identify up/down trend | ✅ Pass |

---

## SECTION R4: Orchestration Modes 🔴👤

### R4.1: Supervisor Mode
**What you're testing:** Multi-agent delegation

| Step | Do This | See This |
|------|---------|----------|
| 1 | Click **Supervisor** pill | Pill highlighted, child agents appear |
| 2 | See amber "Changes pending" banner | Banner visible |
| 3 | Click **Apply & Run** or **Test Agent** | Flow executes |
| 4 | Type: `Compare Scotland vs London performance` | Both analyzed |
| 5 | Response should be comprehensive | ✅ Pass |

---

### R4.2: Router Mode
**What you're testing:** Intent-based routing

| Step | Do This | See This |
|------|---------|----------|
| 1 | Click **Router** pill | Router selected |
| 2 | Click **Advanced Settings** | Panel opens, NOT read-only |
| 3 | See Routes configuration | Routes visible |
| 4 | Click **Test Agent** | Chat opens |
| 5 | Type: `What is our inventory status?` | Routed to Ops agent |
| 6 | Type: `What are top selling products?` | Routed to Sales agent |
| 7 | Different responses based on intent | ✅ Pass |

---

### R4.3: External Agent
**What you're testing:** External integration

| Step | Do This | See This |
|------|---------|----------|
| 1 | Click **External** pill | External selected |
| 2 | Shows external agent config | Config visible |
| 3 | Test Agent (may fail if not configured) | Attempts connection |
| 4 | Error message is clear if fails | ✅ Pass |

---

## SECTION R5: Experience Channels 🟡👤

### R5.1: Channel Switching
**What you're testing:** UI updates per channel

| Step | Do This | See This |
|------|---------|----------|
| 1 | Set Channel = **Snowflake Intelligence** | Shows "Test Agent" button |
| 2 | Set Channel = **REST API** | Shows endpoint URL + request body |
| 3 | Set Channel = **Slack** | Shows "Coming Soon" |
| 4 | Set Channel = **Teams** | Shows "Coming Soon" |
| 5 | Each change shows amber banner | ✅ Pass |

---

### R5.2: API Endpoint Preview
**What you're testing:** REST API details

| Step | Do This | See This |
|------|---------|----------|
| 1 | Set Channel = **REST API** | API section appears |
| 2 | See `POST http://localhost:8000/run/stream` | URL shown |
| 3 | See JSON request body template | Body shown |
| 4 | Click **Copy** button | Copies to clipboard |
| 5 | Paste somewhere to verify | ✅ Pass |

---

## SECTION R6: Data Source Changes 🟡👤

### R6.1: Change Data Source
**What you're testing:** Data layer modification

| Step | Do This | See This |
|------|---------|----------|
| 1 | Scroll to **Data Sources** layer | Layer visible |
| 2 | Click **Browse Data Sources** | Catalog opens |
| 3 | Select a different view/table | Selection made |
| 4 | Click **Apply** | Data source updates |
| 5 | Amber banner appears | ✅ Pass |

---

### R6.2: Change Semantic Model
**What you're testing:** Semantic layer modification

| Step | Do This | See This |
|------|---------|----------|
| 1 | Scroll to **Semantic Model** layer | Layer visible |
| 2 | Click **Change Semantic Model** | Picker opens |
| 3 | Select different model | Selection made |
| 4 | Amber banner appears | ✅ Pass |

---

---

# PART 2: AD/MEDIA SCENARIOS

## Setup (Do Once)

1. Click **Reset** button (top right)
2. Start fresh workflow
3. In Data Source step, select **VW_AD_PERFORMANCE**
4. In Semantic Model, select **ad_media_performance_demo**

---

## SECTION A1: Basic Campaign Questions 🟢👤

### A1.1: Total Spend
**What you're testing:** Basic aggregation

| Step | Do This | See This |
|------|---------|----------|
| 1 | Click **Test Agent** | Chat opens |
| 2 | Type: `What is total ad spend?` | Number returned |
| 3 | Should be in GBP | ✅ Pass |

---

### A1.2: ROAS Overview
**What you're testing:** Calculated metric

| Step | Do This | See This |
|------|---------|----------|
| 1 | Type: `What is our overall ROAS?` | ROAS number |
| 2 | Should be a ratio (e.g., 2.5x) | Ratio format |
| 3 | Or decimal (e.g., 2.5) | ✅ Pass |

---

### A1.3: Impressions by Channel
**What you're testing:** Grouping

| Step | Do This | See This |
|------|---------|----------|
| 1 | Type: `Show impressions by channel` | Table or list |
| 2 | See Search, Social, Video, etc. | Channels listed |
| 3 | Numbers vary by channel | ✅ Pass |

---

### A1.4: Top Advertisers
**What you're testing:** Ranking

| Step | Do This | See This |
|------|---------|----------|
| 1 | Type: `Who are the top 5 advertisers by spend?` | Ranked list |
| 2 | Advertiser names shown | Names visible |
| 3 | Spend amounts attached | ✅ Pass |

---

### A1.5: Conversion Count
**What you're testing:** Simple count

| Step | Do This | See This |
|------|---------|----------|
| 1 | Type: `How many conversions did we get?` | Number |
| 2 | Should be whole number | ✅ Pass |

---

## SECTION A2: Intermediate Performance 🟡👤

### A2.1: CTR Analysis
**What you're testing:** Rate metric

| Step | Do This | See This |
|------|---------|----------|
| 1 | Type: `What is CTR by channel type?` | CTR per channel |
| 2 | Values should be percentages or decimals | Format correct |
| 3 | Search typically higher than Display | ✅ Pass |

---

### A2.2: CPA by Campaign
**What you're testing:** Cost efficiency

| Step | Do This | See This |
|------|---------|----------|
| 1 | Type: `What is cost per acquisition by campaign?` | CPA per campaign |
| 2 | Campaign names shown | Names visible |
| 3 | Lower CPA = better | ✅ Pass |

---

### A2.3: Creative Format Performance
**What you're testing:** Creative analysis

| Step | Do This | See This |
|------|---------|----------|
| 1 | Type: `Which creative format has the best ROAS?` | Format comparison |
| 2 | See Video, Static, Carousel, etc. | Formats listed |
| 3 | One format identified as best | ✅ Pass |

---

### A2.4: Audience Segment Performance
**What you're testing:** Audience analysis

| Step | Do This | See This |
|------|---------|----------|
| 1 | Type: `Compare ROAS for Prospecting vs Remarketing` | Two segments |
| 2 | Both values shown | Comparison visible |
| 3 | Typically Remarketing higher | ✅ Pass |

---

### A2.5: Geographic Performance
**What you're testing:** Geo analysis

| Step | Do This | See This |
|------|---------|----------|
| 1 | Type: `Which region has the highest spend?` | Region identified |
| 2 | Spend amount shown | ✅ Pass |

---

## SECTION A3: Advanced Media Analysis 🔴👤

### A3.1: Budget Optimization
**What you're testing:** Recommendation

| Step | Do This | See This |
|------|---------|----------|
| 1 | Type: `Where should I shift budget to improve ROAS?` | Recommendation |
| 2 | Should mention channels or campaigns | Actionable insight |
| 3 | Reasoning provided | ✅ Pass |

---

### A3.2: Underperforming Campaigns
**What you're testing:** Alert/flag logic

| Step | Do This | See This |
|------|---------|----------|
| 1 | Type: `Which campaigns have ROAS below 1?` | List or message |
| 2 | These are losing money | Makes business sense |
| 3 | If none, says "none" | ✅ Pass |

---

### A3.3: Channel Mix Analysis
**What you're testing:** Multi-dimension

| Step | Do This | See This |
|------|---------|----------|
| 1 | Type: `What percentage of spend goes to each channel type?` | Percentages |
| 2 | Should sum to ~100% | Math correct |
| 3 | See Search, Social, Video, etc. | ✅ Pass |

---

### A3.4: Week-over-Week Trend
**What you're testing:** Time comparison

| Step | Do This | See This |
|------|---------|----------|
| 1 | Type: `How did conversions change week over week?` | WoW comparison |
| 2 | Shows increase or decrease | Direction clear |
| 3 | Percentage or absolute change | ✅ Pass |

---

### A3.5: Industry Benchmark
**What you're testing:** Contextual analysis

| Step | Do This | See This |
|------|---------|----------|
| 1 | Type: `How does our CTR compare across industries?` | Industry breakdown |
| 2 | Multiple industries shown | Comparison visible |
| 3 | Our performance contextualized | ✅ Pass |

---

## SECTION A4: Multi-Agent Ad Scenarios 🔴👤

### A4.1: Supervisor - Full Campaign Review
**What you're testing:** Supervisor delegation

| Step | Do This | See This |
|------|---------|----------|
| 1 | Set Agent = **Supervisor** | Supervisor selected |
| 2 | Click **Test Agent** | Chat opens |
| 3 | Type: `Give me a full performance review of Campaign Alpha` | Comprehensive response |
| 4 | Should cover spend, conversions, ROAS, CTR | Multiple metrics |
| 5 | Feels like a report | ✅ Pass |

---

### A4.2: Router - Intent Detection
**What you're testing:** Router logic

| Step | Do This | See This |
|------|---------|----------|
| 1 | Set Agent = **Router** | Router selected |
| 2 | Type: `What is our brand awareness?` | Routes to Brand agent |
| 3 | Type: `How many sales did we drive?` | Routes to Performance agent |
| 4 | Different responses based on intent | ✅ Pass |

---

---

# PART 3: ADMIN SCENARIOS 🛡️

## SECTION AD1: Control Tower

### AD1.1: Open Control Tower
**What you're testing:** Admin access

| Step | Do This | See This |
|------|---------|----------|
| 1 | Click **Control Tower** button (bottom left) | Modal opens |
| 2 | See "SnowFlow Control Tower" title | Title visible |
| 3 | See tabs: Overview, Agents, Audit, Settings | Tabs present |
| 4 | Close modal with X | ✅ Pass |

---

### AD1.2: View Agent Registry
**What you're testing:** Agent management

| Step | Do This | See This |
|------|---------|----------|
| 1 | Open Control Tower | Modal opens |
| 2 | Click **Agents** tab | Agent list shown |
| 3 | See registered agents | At least 1 agent |
| 4 | See status (active/inactive) | ✅ Pass |

---

### AD1.3: View Audit Log
**What you're testing:** Audit trail

| Step | Do This | See This |
|------|---------|----------|
| 1 | Click **Audit** tab | Audit log shown |
| 2 | See recent actions | Timestamps visible |
| 3 | See who did what | ✅ Pass |

---

### AD1.4: Change Settings
**What you're testing:** Governance config

| Step | Do This | See This |
|------|---------|----------|
| 1 | Click **Settings** tab | Settings form |
| 2 | Toggle a setting (e.g., audit enabled) | Toggle changes |
| 3 | Click Save | Settings saved |
| 4 | Close and reopen | Settings persisted |
| 5 | ✅ Pass |

---

## SECTION AD2: Governance

### AD2.1: Governance Panel
**What you're testing:** Governance status

| Step | Do This | See This |
|------|---------|----------|
| 1 | Click **Governance** button (top right, yellow/green) | Panel opens |
| 2 | See governance status indicator | Color shown |
| 3 | See data lineage or policies | Info displayed |
| 4 | ✅ Pass |

---

---

# PART 4: UI/UX SCENARIOS 👤

## SECTION U1: Theme & Display

### U1.1: Dark/Light Mode
**What you're testing:** Theme toggle

| Step | Do This | See This |
|------|---------|----------|
| 1 | Find theme toggle (sun/moon icon) | Icon visible |
| 2 | Click to switch theme | Colors change |
| 3 | Dark = dark background | Correct theme |
| 4 | Light = light background | Correct theme |
| 5 | ✅ Pass |

---

### U1.2: Resizable Sidebar
**What you're testing:** Sidebar resize

| Step | Do This | See This |
|------|---------|----------|
| 1 | Hover on sidebar right edge | Cursor changes |
| 2 | Drag right | Sidebar widens |
| 3 | Drag left | Sidebar narrows |
| 4 | Has min/max limits | ✅ Pass |

---

## SECTION U2: Graph View

### U2.1: Switch to Graph View
**What you're testing:** View toggle

| Step | Do This | See This |
|------|---------|----------|
| 1 | Click **Graph** tab (top left) | Canvas changes |
| 2 | See node-and-edge view | Nodes visible |
| 3 | Can drag nodes | Nodes move |
| 4 | Click **Guided** to go back | ✅ Pass |

---

### U2.2: Canvas Pan & Zoom
**What you're testing:** Navigation

| Step | Do This | See This |
|------|---------|----------|
| 1 | In Graph view, scroll mouse wheel | Canvas zooms |
| 2 | Click and drag empty space | Canvas pans |
| 3 | Use +/- buttons (bottom left) | Zoom controls work |
| 4 | ✅ Pass |

---

### U2.3: Node Selection
**What you're testing:** Selection

| Step | Do This | See This |
|------|---------|----------|
| 1 | Click a node | Node highlighted |
| 2 | Properties panel opens | Panel visible |
| 3 | Click empty space | Node deselected |
| 4 | ✅ Pass |

---

### U2.4: Edge Deletion
**What you're testing:** Edge management

| Step | Do This | See This |
|------|---------|----------|
| 1 | Click an edge (connection line) | Edge selected |
| 2 | Press Delete or Backspace | Edge removed |
| 3 | Nodes still exist | ✅ Pass |

---

## SECTION U3: Workflow Management

### U3.1: Save Workflow
**What you're testing:** Save functionality

| Step | Do This | See This |
|------|---------|----------|
| 1 | Enter workflow name in top bar | Name typed |
| 2 | Click **Save** | Save triggered |
| 3 | Toast says "Saved" or similar | Success message |
| 4 | ✅ Pass |

---

### U3.2: Load Workflow
**What you're testing:** Load functionality

| Step | Do This | See This |
|------|---------|----------|
| 1 | Click **Open** | Workflow list opens |
| 2 | Select a saved workflow | Click to select |
| 3 | Click Load/Open | Workflow loads |
| 4 | Canvas shows saved nodes | ✅ Pass |

---

### U3.3: New Workflow
**What you're testing:** New/reset

| Step | Do This | See This |
|------|---------|----------|
| 1 | Click **New** | Confirmation may appear |
| 2 | Confirm if asked | Canvas clears |
| 3 | Fresh empty state | ✅ Pass |

---

### U3.4: Export Workflow
**What you're testing:** Export

| Step | Do This | See This |
|------|---------|----------|
| 1 | Click **Export** | Download starts |
| 2 | JSON file downloaded | File in Downloads |
| 3 | Open file, see JSON | Valid JSON |
| 4 | ✅ Pass |

---

### U3.5: Import Workflow
**What you're testing:** Import

| Step | Do This | See This |
|------|---------|----------|
| 1 | Click **Import** | File picker opens |
| 2 | Select a workflow JSON | File selected |
| 3 | Workflow loads on canvas | Nodes appear |
| 4 | ✅ Pass |

---

## SECTION U4: Templates

### U4.1: Load Template
**What you're testing:** Template system

| Step | Do This | See This |
|------|---------|----------|
| 1 | Click **Templates** tab in sidebar | Template list |
| 2 | Click a template | Template selected |
| 3 | Click "Use Template" | Canvas populates |
| 4 | ✅ Pass |

---

---

# PART 5: PERFORMANCE SCENARIOS ⚡

## SECTION P1: Response Time

### P1.1: Simple Query Speed
**What you're testing:** Basic performance

| Step | Do This | See This |
|------|---------|----------|
| 1 | Type: `What is total sales?` | Timer in head |
| 2 | Response appears | Note time |
| 3 | Should be < 10 seconds | ✅ Pass if fast |

---

### P1.2: Complex Query Speed
**What you're testing:** Complex performance

| Step | Do This | See This |
|------|---------|----------|
| 1 | Type: `Show margin by category, region, and month for last quarter` | Timer |
| 2 | Response appears | Note time |
| 3 | Should be < 30 seconds | ✅ Pass if reasonable |

---

### P1.3: Control Tower Load
**What you're testing:** Admin panel speed

| Step | Do This | See This |
|------|---------|----------|
| 1 | Click Control Tower | Timer |
| 2 | Modal fully loads | Note time |
| 3 | Should be < 3 seconds | ✅ Pass if fast |

---

---

# PART 6: ERROR HANDLING SCENARIOS

## SECTION E1: Graceful Failures

### E1.1: Invalid Query
**What you're testing:** Bad input handling

| Step | Do This | See This |
|------|---------|----------|
| 1 | Type: `asdfghjkl` | Send nonsense |
| 2 | Agent responds | Some response |
| 3 | Says "I don't understand" or tries anyway | No crash |
| 4 | ✅ Pass |

---

### E1.2: Empty Query
**What you're testing:** Empty input

| Step | Do This | See This |
|------|---------|----------|
| 1 | Press Enter with no text | Send empty |
| 2 | Nothing happens or error shown | No crash |
| 3 | ✅ Pass |

---

### E1.3: Backend Down
**What you're testing:** Backend failure

| Step | Do This | See This |
|------|---------|----------|
| 1 | Stop backend (Ctrl+C in terminal) | Backend off |
| 2 | Try to run a query | Send query |
| 3 | Error message appears | "Cannot connect" |
| 4 | App doesn't crash | ✅ Pass |
| 5 | Restart backend | ✅ Restore |

---

### E1.4: Incomplete Setup - No Output Node
**What you're testing:** Pre-flight validation blocks incomplete flows

| Step | Do This | See This |
|------|---------|----------|
| 1 | Start Guided Canvas | Fresh state |
| 2 | Configure Data Source | ✅ Step 1 done |
| 3 | Configure Semantic Model | ✅ Step 2 done |
| 4 | Choose Orchestration | ✅ Step 3 done |
| 5 | **Do NOT click "Complete Setup"** | Skip step 4 |
| 6 | Type query in chat input and press Enter | Try to run |
| 7 | **Validation Panel appears** with error: "No output node configured" | ❌ Blocked |
| 8 | Suggestion says: "Click 'Complete Setup' to add an output node" | Helpful message |
| 9 | ✅ Pass - Blocked with clear guidance |

---

### E1.5: Invalid Data Source - Table Not Found
**What you're testing:** Validation catches non-existent tables

| Step | Do This | See This |
|------|---------|----------|
| 1 | In Graph mode, add a Snowflake Source node | Node added |
| 2 | Manually set database/schema/table to fake values | e.g., `FAKE_DB.FAKE_SCHEMA.FAKE_TABLE` |
| 3 | Add Agent and Output nodes, connect them | Complete flow |
| 4 | Try to run a query | Submit |
| 5 | **Validation Panel appears** with error: "Table does not exist" | ❌ Blocked |
| 6 | Suggestion says: "Verify the table name is correct" | Helpful message |
| 7 | ✅ Pass - Blocked with clear guidance |

---

### E1.6: Snowflake Token Expired
**What you're testing:** Authentication error handling

| Step | Do This | See This |
|------|---------|----------|
| 1 | Wait for Snowflake token to expire (or simulate) | Token invalid |
| 2 | Try to run a query | Submit |
| 3 | **Validation Panel appears** with error: "Token expired" | ❌ Blocked |
| 4 | Suggestion includes: "Restart the backend to refresh" | Troubleshooting steps |
| 5 | Troubleshooting details show exact commands | Actionable |
| 6 | ✅ Pass - Clear recovery path |

---

### E1.7: Disconnected Agent Node
**What you're testing:** Graph integrity validation

| Step | Do This | See This |
|------|---------|----------|
| 1 | In Graph mode, add Data Source, Agent, Output | Nodes added |
| 2 | Connect Data Source to Output (skip Agent) | Agent orphaned |
| 3 | Try to run a query | Submit |
| 4 | **Warning appears**: "Agent is not connected to a data source" | ⚠️ Warning |
| 5 | Can click "Run Anyway" to proceed | Option given |
| 6 | Or click "Fix Issues" to correct the graph | Option given |
| 7 | ✅ Pass - Warns but allows override |

---

### E1.8: No Data Source Configured
**What you're testing:** Required node validation

| Step | Do This | See This |
|------|---------|----------|
| 1 | In Graph mode, add only Agent and Output | No data source |
| 2 | Connect Agent to Output | Flow looks complete |
| 3 | Try to run a query | Submit |
| 4 | **Validation Panel appears** with error: "No data source configured" | ❌ Blocked |
| 5 | Suggestion: "Click on the Data Source layer and select a Table or View" | Helpful |
| 6 | ✅ Pass - Blocked with clear guidance |

---

### E1.9: Invalid Semantic Model Path
**What you're testing:** Semantic model file validation

| Step | Do This | See This |
|------|---------|----------|
| 1 | Add a Semantic Model node | Node added |
| 2 | Manually set path to invalid value | e.g., `not_a_yaml.txt` |
| 3 | Complete flow and try to run | Submit |
| 4 | **Warning appears**: "Semantic model path should end with .yaml" | ⚠️ Warning |
| 5 | Can still proceed if desired | Not blocking |
| 6 | ✅ Pass - Warns about potential issue |

---

### E1.10: Empty Table Warning
**What you're testing:** Data quality warnings

| Step | Do This | See This |
|------|---------|----------|
| 1 | Connect to a table with 0 rows | Empty table |
| 2 | Complete flow and try to run | Submit |
| 3 | **Warning appears**: "Table has no data" | ⚠️ Warning |
| 4 | Suggestion: "Queries will return empty results" | Helpful |
| 5 | Can proceed with "Run Anyway" | Option given |
| 6 | ✅ Pass - Warns about empty data |

---

### E1.11: Permission Denied on Table
**What you're testing:** Access control error handling

| Step | Do This | See This |
|------|---------|----------|
| 1 | Connect to a table user doesn't have SELECT on | No permission |
| 2 | Try to run a query | Submit |
| 3 | **Error appears**: "No permission to access table" | ❌ Blocked |
| 4 | Suggestion: "Ask your Snowflake admin to grant SELECT" | Actionable |
| 5 | ✅ Pass - Clear explanation of access issue |

---

### E1.12: Validation Panel UX
**What you're testing:** User experience of error panel

| Step | Do This | See This |
|------|---------|----------|
| 1 | Trigger any validation error (e.g., E1.4) | Error shown |
| 2 | **Panel has clear title**: "Can't Run Workflow" | Obvious |
| 3 | **Errors are red** with ❌ icon | Visual distinction |
| 4 | **Warnings are amber** with ⚠️ icon | Visual distinction |
| 5 | **Each error has "How to fix" section** | Actionable |
| 6 | **"Fix Issues" button** dismisses panel | Easy to close |
| 7 | Panel is scrollable if many errors | Usable |
| 8 | ✅ Pass - Panel is clear and helpful |

---

---

# PART 7: EDGE CASES

## SECTION EC1: Boundary Tests

### EC1.1: Very Long Query
**What you're testing:** Input limits

| Step | Do This | See This |
|------|---------|----------|
| 1 | Type a 500+ character question | Long text |
| 2 | Send it | Submit |
| 3 | Either processes or shows limit error | No crash |
| 4 | ✅ Pass |

---

### EC1.2: Special Characters
**What you're testing:** Input sanitization

| Step | Do This | See This |
|------|---------|----------|
| 1 | Type: `What is sales for "Food & Beverage"?` | Special chars |
| 2 | Send it | Submit |
| 3 | Processes correctly | No SQL injection |
| 4 | ✅ Pass |

---

### EC1.3: Rapid Clicking
**What you're testing:** Rate limiting

| Step | Do This | See This |
|------|---------|----------|
| 1 | Click Test Agent 10 times fast | Rapid clicks |
| 2 | App handles gracefully | No duplicates |
| 3 | ✅ Pass |

---

---

# EXECUTION LOG

| Test ID | Date | Tester | Result | Notes |
|---------|------|--------|--------|-------|
| R1.1 | | | | |
| R1.2 | | | | |
| R1.3 | | | | |
| R1.4 | | | | |
| R1.5 | | | | |
| R2.1 | | | | |
| R2.2 | | | | |
| R2.3 | | | | |
| R2.4 | | | | |
| R2.5 | | | | |
| R3.1 | | | | |
| R3.2 | | | | |
| R3.3 | | | | |
| R4.1 | | | | |
| R4.2 | | | | |
| R4.3 | | | | |
| R5.1 | | | | |
| R5.2 | | | | |
| R6.1 | | | | |
| R6.2 | | | | |
| A1.1 | | | | |
| A1.2 | | | | |
| A1.3 | | | | |
| A1.4 | | | | |
| A1.5 | | | | |
| A2.1 | | | | |
| A2.2 | | | | |
| A2.3 | | | | |
| A2.4 | | | | |
| A2.5 | | | | |
| A3.1 | | | | |
| A3.2 | | | | |
| A3.3 | | | | |
| A3.4 | | | | |
| A3.5 | | | | |
| A4.1 | | | | |
| A4.2 | | | | |
| AD1.1 | | | | |
| AD1.2 | | | | |
| AD1.3 | | | | |
| AD1.4 | | | | |
| AD2.1 | | | | |
| U1.1 | | | | |
| U1.2 | | | | |
| U2.1 | | | | |
| U2.2 | | | | |
| U2.3 | | | | |
| U2.4 | | | | |
| U3.1 | | | | |
| U3.2 | | | | |
| U3.3 | | | | |
| U3.4 | | | | |
| U3.5 | | | | |
| U4.1 | | | | |
| P1.1 | | | | |
| P1.2 | | | | |
| P1.3 | | | | |
| E1.1 | | | | |
| E1.2 | | | | |
| E1.3 | | | | |
| E1.4 | | | | |
| E1.5 | | | | |
| E1.6 | | | | |
| E1.7 | | | | |
| E1.8 | | | | |
| E1.9 | | | | |
| E1.10 | | | | |
| E1.11 | | | | |
| E1.12 | | | | |
| EC1.1 | | | | |
| EC1.2 | | | | |
| EC1.3 | | | | |

---

## Feature Coverage Matrix

| Feature | Test IDs |
|---------|----------|
| Single Agent | R1.*, A1.* |
| Supervisor Mode | R4.1, A4.1 |
| Router Mode | R4.2, A4.2 |
| External Agent | R4.3 |
| Snowflake Intelligence Channel | R1-R4, A1-A4 |
| REST API Channel | R5.2 |
| Slack Channel | R5.1 |
| Teams Channel | R5.1 |
| Channel Switching | R5.1 |
| Amber Warning Banner | R4.*, R5.*, R6.* |
| Data Source Selection | R6.1 |
| Semantic Model Selection | R6.2 |
| Control Tower | AD1.* |
| Agent Registry | AD1.2 |
| Audit Log | AD1.3 |
| Settings | AD1.4 |
| Governance Panel | AD2.1 |
| Dark/Light Mode | U1.1 |
| Resizable Sidebar | U1.2 |
| Graph View | U2.* |
| Guided View | R*, A* |
| Pan & Zoom | U2.2 |
| Node Selection | U2.3 |
| Edge Deletion | U2.4 |
| Save Workflow | U3.1 |
| Load Workflow | U3.2 |
| New Workflow | U3.3 |
| Export Workflow | U3.4 |
| Import Workflow | U3.5 |
| Templates | U4.1 |
| Response Time | P1.* |
| Error Handling | E1.1-E1.3 |
| Pre-flight Validation | E1.4-E1.12 |
| Validation Panel UX | E1.12 |
| Edge Cases | EC1.* |

---

**Total Test Cases: 67**
**Estimated Time: 2.5-3.5 hours for full run**
