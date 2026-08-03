# Meta Ads API data map

This folder contains local exports from Meta Marketing API and the official Meta Business SDK.

## Generated files

- `meta-ads-sample-fields.md` - readable table with fields, types, and example values returned by the current token/account.
- `meta-ads-sample-responses.json` - raw sample API responses.
- `meta-ads-fields.md` - focused field inventory for AdAccount, Campaign, AdSet, Ad, AdCreative, AdsInsights.
- `meta-ads-fields.json` - machine-readable version of the focused field inventory.
- `meta-business-sdk-all-fields.md` - broad inventory of all adobject field constants from the official Meta Business SDK.
- `meta-business-sdk-all-fields.json` - machine-readable version of the broad SDK inventory.

## Main data groups Meta can return

### Account and business data

Endpoint examples:

- `/me/adaccounts`
- `/{ad_account_id}`
- `/{business_id}`

Typical data:

- ad account id, name, status, currency, timezone
- business owner, billing/funding source metadata
- capabilities and restrictions
- account spend, balance, limits

### Campaign structure

Endpoint examples:

- `/{ad_account_id}/campaigns`
- `/{campaign_id}`

Typical data:

- campaign id and name
- objective
- status and effective status
- budget and spend limits
- special ad categories
- created/updated/start/stop times

### Ad set targeting and delivery settings

Endpoint examples:

- `/{ad_account_id}/adsets`
- `/{campaign_id}/adsets`
- `/{adset_id}`

Typical data:

- campaign relation
- budget
- optimization goal
- billing event
- schedule
- targeting: countries, cities, age, gender, interests, behaviors, custom audiences, exclusions, placements
- promoted object: pixel, page, app, lead form, product set

### Ads

Endpoint examples:

- `/{ad_account_id}/ads`
- `/{adset_id}/ads`
- `/{ad_id}`

Typical data:

- campaign/adset relation
- connected creative
- status and effective status
- tracking specs
- conversion domain
- created/updated times

### Creatives

Endpoint examples:

- `/{ad_account_id}/adcreatives`
- `/{adcreative_id}`

Typical data:

- text/body/title
- image/video ids and URLs
- thumbnail URL
- call to action
- lead form id
- page id
- Instagram user id
- object story spec
- dynamic creative asset feed spec

### Insights and performance

Endpoint examples:

- `/{ad_account_id}/insights`
- `/{campaign_id}/insights`
- `/{adset_id}/insights`
- `/{ad_id}/insights`

Typical data:

- impressions, reach, frequency
- spend
- clicks, CTR, CPC, CPM, CPP
- link clicks, outbound clicks
- leads and conversions
- action arrays
- cost per action
- video views and watch percentages
- date ranges

Useful breakdown groups:

- age
- gender
- country
- region
- publisher platform
- platform position
- device platform
- impression device

Meta returns aggregated reporting data only. It does not return names or profiles of people who saw an ad.

### Audiences

Endpoint examples:

- `/{ad_account_id}/customaudiences`
- `/{custom_audience_id}`
- `/{ad_account_id}/saved_audiences`

Typical data:

- custom audience id and name
- approximate count
- subtype
- retention
- delivery status
- rule/spec metadata when available

### Lead forms and leads

Endpoint examples:

- `/{page_id}/leadgen_forms`
- `/{leadgen_form_id}/leads`
- `/{lead_id}`

Typical data:

- form id and name
- questions
- submitted lead field data
- created time
- campaign/ad/adset references when available

This requires page and lead access permissions. Leads may contain personal data, so handle exports carefully.

### Pixels and conversion tracking

Endpoint examples:

- `/{ad_account_id}/adspixels`
- `/{pixel_id}`
- `/{pixel_id}/events`

Typical data:

- pixel id and name
- event names
- event stats/diagnostics when permitted
- connected business/ad account metadata

### Media assets

Endpoint examples:

- `/{ad_account_id}/adimages`
- `/{ad_account_id}/advideos`
- `/{image_hash}`
- `/{video_id}`

Typical data:

- image hash and URL
- video id, title, thumbnails
- asset status
- dimensions and metadata when available

### Product catalog data

Endpoint examples:

- `/{business_id}/owned_product_catalogs`
- `/{product_catalog_id}/products`
- `/{product_set_id}`

Typical data:

- catalog id and name
- products/items
- product sets
- availability, price, image URL, product URLs

### Pages and Instagram assets

Endpoint examples:

- `/{page_id}`
- `/{ig_user_id}`

Typical data:

- connected page/Instagram ids
- names/usernames
- permissions-dependent metadata
- posts/media references used by creatives

## Commands

Regenerate field inventories:

```bash
npm run meta:ads-fields
```

Regenerate real sample responses:

```bash
npm run meta:ads-samples
```

View sample field table:

```bash
less docs/meta-ads-fields/meta-ads-sample-fields.md
```

View raw object samples:

```bash
jq '.objects.Campaign.data' docs/meta-ads-fields/meta-ads-sample-responses.json
jq '.objects.AdSet.data' docs/meta-ads-fields/meta-ads-sample-responses.json
jq '.objects.Ad.data' docs/meta-ads-fields/meta-ads-sample-responses.json
jq '.objects.AdCreative.data' docs/meta-ads-fields/meta-ads-sample-responses.json
jq '.objects.AdsInsights.data' docs/meta-ads-fields/meta-ads-sample-responses.json
```
