# Meta Ads sample response fields

Generated: 2026-07-31T14:27:55.023Z
API version: v25.0
Ad account: act_905947703389624

## Campaign

Status: ok
Sample id: 120249960544200494

| Field | Type | Example |
| --- | --- | --- |
| `account_id` | string | 905947703389624 |
| `advantage_state_info` | object | {"advantage_state":"DISABLED","advantage_budget_state":"ENABLED","advantage_audience_state":"DISA... |
| `budget_rebalance_flag` | boolean | false |
| `budget_remaining` | string | 0 |
| `buying_type` | string | AUCTION |
| `campaign_group_active_time` | string | 0 |
| `can_create_brand_lift_study` | boolean | false |
| `can_use_spend_cap` | boolean | true |
| `configured_status` | string | PAUSED |
| `created_time` | string | 2026-06-16T09:49:54+0300 |
| `effective_status` | string | PAUSED |
| `has_secondary_skadnetwork_reporting` | boolean | false |
| `id` | string | 120249960544200494 |
| `is_adset_budget_sharing_enabled` | boolean | false |
| `is_budget_schedule_enabled` | boolean | false |
| `is_direct_send_campaign` | boolean | false |
| `is_message_campaign` | boolean | false |
| `is_meta_moment_maker_enabled` | boolean | false |
| `is_reels_trending_ads_enabled` | boolean | false |
| `is_skadnetwork_attribution` | boolean | false |
| `name` | string | [V.T] MoF \| Lead - form \| Webinar \| (UA Lang) \| 16.06.26 |
| `objective` | string | OUTCOME_LEADS |
| `primary_attribution` | string | DEFAULT |
| `smart_promotion_type` | string | GUIDED_CREATION |
| `source_campaign` | object | {"id":"120249957335660494"} |
| `source_campaign_id` | string | 120249957335660494 |
| `special_ad_categories` | array | ["HOUSING"] |
| `special_ad_category` | string | HOUSING |
| `special_ad_category_country` | array | ["AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IS","IE","IT","LV","LI","LT","... |
| `start_time` | string | 2026-06-16T09:49:55+0300 |
| `status` | string | PAUSED |
| `topline_id` | string | 0 |
| `updated_time` | string | 2026-06-16T20:50:46+0300 |

## AdSet

Status: missing_sample_object

No sample data returned.

## Ad

Status: ok
Sample id: 120246137453860494

| Field | Type | Example |
| --- | --- | --- |
| `account_id` | string | 905947703389624 |
| `ad_active_time` | string | 0 |
| `adset` | object | {"id":"120246137439260494"} |
| `adset_id` | string | 120246137439260494 |
| `bid_type` | string | ABSOLUTE_OCPM |
| `campaign` | object | {"id":"120244836175640494"} |
| `campaign_id` | string | 120244836175640494 |
| `configured_status` | string | ACTIVE |
| `conversion_specs` | array | [{"action.type":["leadgen"],"leadgen":["1145820758804919"]}] |
| `created_time` | string | 2026-04-23T14:09:14+0300 |
| `creative` | object | {"id":"1482483036916512"} |
| `demolink_hash` | string | AQKehHj92aGU8jxOs0qz8pqvNM8 |
| `display_sequence` | number | 0 |
| `effective_status` | string | ADSET_PAUSED |
| `engagement_audience` | boolean | false |
| `id` | string | 120246137453860494 |
| `last_updated_by_app_id` | string | 119211728144504 |
| `name` | string | 190K Video 1 (real estate) |
| `preview_shareable_link` | string | https://fb.me/26kQTCyvmIj4ZLy |
| `source_ad` | object | {"id":"120245681406490494"} |
| `source_ad_id` | string | 120245681406490494 |
| `status` | string | ACTIVE |
| `targeting` | object | {"age_max":65,"age_min":18,"excluded_custom_audiences":[{"id":"120214744229400494","name":"Submit... |
| `tracking_and_conversion_with_defaults` | object | {"default_conversion":[{"action.type":["leadgen"]}],"default_tracking":[{"action.type":["onsite_c... |
| `tracking_specs` | array | [{"action.type":["onsite_conversion"]},{"action.type":["onsite_conversion"],"conversion_id":["276... |
| `updated_time` | string | 2026-07-29T13:58:21+0300 |

## AdCreative

Status: ok
Sample id: 1482483036916512

| Field | Type | Example |
| --- | --- | --- |
| `account_id` | string | 905947703389624 |
| `actor_id` | string | 792326597487672 |
| `asset_feed_spec` | object | {"bodies":[{"text":"🇪🇸 Надаємо фінансову модель по кожному обʼєкту.\n\n📍 Вигідні об'єкти від п... |
| `authorization_category` | string | NONE |
| `body` | string | 🇪🇸 Надаємо фінансову модель по кожному обʼєкту.  📍 Вигідні об'єкти від пер... |
| `call_to_action` | object | {"type":"APPLY_NOW","value":{"lead_gen_form_id":"2372058299926056","link":"http://fb.me/"}} |
| `call_to_action_type` | string | APPLY_NOW |
| `contextual_multi_ads` | object | {"enroll_status":"OPT_IN"} |
| `degrees_of_freedom_spec` | object | {"creative_features_spec":{"advantage_plus_creative":{"enroll_status":"OPT_OUT"},"inline_comment"... |
| `effective_authorization_category` | string | NONE |
| `effective_instagram_media_id` | string | 18061976024398031 |
| `effective_object_story_id` | string | 792326597487672_1565100388948891 |
| `enable_direct_install` | boolean | false |
| `enable_launch_instant_app` | boolean | false |
| `id` | string | 1482483036916512 |
| `instagram_permalink_url` | string | https://www.instagram.com/p/DXLs5eFAILD/ |
| `instagram_user_id` | string | 17841402096925229 |
| `name` | string | 👉 Залиште заявку зараз 2026-04-15-449bb29fb4da57908368a291c1de372b |
| `object_story_spec` | object | {"page_id":"792326597487672","instagram_user_id":"17841402096925229","video_data":{"video_id":"72... |
| `object_type` | string | VIDEO |
| `status` | string | ACTIVE |
| `thumbnail_id` | string | 1237837687970147 |
| `thumbnail_url` | string | https://scontent-mrs2-1.xx.fbcdn.net/v/t15.5256-10/638306717_2412672555845440... |
| `title` | string | 👉 Залиште заявку зараз |
| `use_page_actor_override` | boolean | false |
| `video_id` | string | 1599624564479853 |

## AdsInsights

Status: ok

| Field | Type | Example |
| --- | --- | --- |
| `account_currency` | string | USD |
| `account_id` | string | 905947703389624 |
| `account_name` | string | Deniz Estate |
| `action_values` | array | [{"action_type":"offsite_conversion.fb_pixel_view_content","value":"5677273.95"},{"action_type":"... |
| `actions` | array | [{"action_type":"onsite_conversion.lead","value":"3"},{"action_type":"offsite_complete_registrati... |
| `anchor_event_attribution_setting` | string | na |
| `attribution_setting` | string | multiple |
| `clicks` | string | 1598 |
| `conversion_lead_rate` | array | [{"action_type":"conversion_lead","value":"0.45098"}] |
| `conversion_leads` | array | [{"action_type":"conversion_lead","value":"23"}] |
| `conversion_rate_ranking` | string | UNKNOWN |
| `conversions` | array | [{"action_type":"offsite_conversion.fb_pixel_custom.Контакт встановлено","value":"9"},{"action_ty... |
| `cost_per_15_sec_video_view` | array | [{"action_type":"video_view","value":"0.132645"}] |
| `cost_per_6_sec_video_view` | array | [{"action_type":"video_view","value":"0.068031"}] |
| `cost_per_action_type` | array | [{"action_type":"onsite_conversion.lead","value":"233.233333"},{"action_type":"offsite_submit_app... |
| `cost_per_conversion` | array | [{"action_type":"offsite_conversion.fb_pixel_custom.Контакт встановлено","value":"77.744444"},{"a... |
| `cost_per_conversion_lead` | array | [{"action_type":"conversion_lead","value":"30.421739"}] |
| `cost_per_inline_link_click` | string | 1.083127 |
| `cost_per_inline_post_engagement` | string | 0.750751 |
| `cost_per_outbound_click` | array | [{"action_type":"outbound_click","value":"33.319048"}] |
| `cost_per_thruplay` | array | [{"action_type":"video_view","value":"0.132645"}] |
| `cost_per_unique_action_type` | array | [{"action_type":"link_click","value":"1.173993"}] |
| `cost_per_unique_click` | string | 0.539476 |
| `cost_per_unique_inline_link_click` | string | 1.173993 |
| `cost_per_unique_outbound_click` | array | [{"action_type":"outbound_click","value":"36.826316"}] |
| `cpc` | string | 0.43786 |
| `cpm` | string | 6.625257 |
| `cpp` | string | 14.573744 |
| `created_time` | string | 0 |
| `creative_media_type` | string | MIXED |
| `ctr` | string | 1.5131 |
| `date_start` | string | 2026-07-01 |
| `date_stop` | string | 2026-07-30 |
| `engagement_rate_ranking` | string | UNKNOWN |
| `frequency` | string | 2.199725 |
| `full_view_impressions` | string | 0 |
| `full_view_reach` | string | 0 |
| `impressions` | string | 105611 |
| `inline_link_click_ctr` | string | 0.611679 |
| `inline_link_clicks` | string | 646 |
| `inline_post_engagement` | string | 20845 |
| `landing_page_view_actions_per_link_click` | string | 1.702786 |
| `landing_page_view_per_link_click` | string | 1.702786 |
| `marketing_messages_click_rate_benchmark` | string | 0 |
| `marketing_messages_cost_per_delivered` | string | 0 |
| `marketing_messages_cost_per_link_btn_click` | string | 0 |
| `marketing_messages_delivered` | string | 0 |
| `marketing_messages_delivery_rate` | string | 0 |
| `marketing_messages_link_btn_click` | string | 0 |
| `marketing_messages_link_btn_click_rate` | string | 0 |
| `marketing_messages_quick_reply_btn_click` | string | 0 |
| `marketing_messages_quick_reply_btn_click_rate` | string | 0 |
| `marketing_messages_read` | string | 0 |
| `marketing_messages_read_rate` | string | 0 |
| `marketing_messages_read_rate_benchmark` | string | 0 |
| `marketing_messages_sent` | string | 0 |
| `marketing_messages_spend` | string | 0 |
| `multi_event_conversion_attribution_setting` | string | na |
| `objective` | string | MULTIPLE |
| `optimization_goal` | string | Unknown Optimization Goal |
| `outbound_clicks` | array | [{"action_type":"outbound_click","value":"21"}] |
| `outbound_clicks_ctr` | array | [{"action_type":"outbound_click","value":"0.019884"}] |
| `quality_ranking` | string | UNKNOWN |
| `reach` | string | 48011 |
| `shops_assisted_purchases` | string | 0 |
| `social_spend` | string | 66.33 |
| `spend` | string | 699.7 |
| `unique_actions` | array | [{"action_type":"link_click","value":"596"}] |
| `unique_clicks` | string | 1297 |
| `unique_ctr` | string | 2.701464 |
| `unique_inline_link_click_ctr` | string | 1.241382 |
| `unique_inline_link_clicks` | string | 596 |
| `unique_link_clicks_ctr` | string | 1.241382 |
| `unique_outbound_clicks` | array | [{"action_type":"outbound_click","value":"19"}] |
| `unique_outbound_clicks_ctr` | array | [{"action_type":"outbound_click","value":"0.039574"}] |
| `updated_time` | string | 0 |
| `video_15_sec_watched_actions` | array | [{"action_type":"video_view","value":"5275"}] |
| `video_30_sec_watched_actions` | array | [{"action_type":"video_view","value":"2658"}] |
| `video_6_sec_watched_actions` | array | [{"action_type":"video_view","value":"10285"}] |
| `video_avg_time_watched_actions` | array | [{"action_type":"video_view","value":"3"}] |
| `video_p100_watched_actions` | array | [{"action_type":"video_view","value":"1870"}] |
| `video_p25_watched_actions` | array | [{"action_type":"video_view","value":"8952"}] |
| `video_p50_watched_actions` | array | [{"action_type":"video_view","value":"4326"}] |
| `video_p75_watched_actions` | array | [{"action_type":"video_view","value":"2996"}] |
| `video_p95_watched_actions` | array | [{"action_type":"video_view","value":"2074"}] |
| `video_play_actions` | array | [{"action_type":"video_view","value":"101028"}] |
| `video_thruplay_watched_actions` | array | [{"action_type":"video_view","value":"5275"}] |
| `video_view_per_impression` | array | [{"action_type":"video_view","value":"18.887237"}] |
| `website_ctr` | array | [{"action_type":"link_click","value":"0.611679"}] |
| `wish_bid` | string | 0 |

