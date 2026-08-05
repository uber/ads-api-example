#!/usr/bin/env bash
#
# End-to-end walkthrough of the Uber Ads API using nothing but curl and jq.
#
# Runs the OAuth authorization code flow, then reads ad accounts, stores,
# campaigns, ad groups, ads and products, and runs both a sync and an async
# report.
#
#   ./scripts/uber-ads-api.sh            # read-only
#   CREATE=1 ./scripts/uber-ads-api.sh   # also creates a paused campaign
#
# Requires: curl, jq, and a `.env.local` containing UBER_CLIENT_ID and
# UBER_CLIENT_SECRET. See .env.example.
#
# Docs: https://developer.uber.com/docs/ads/introduction

set -euo pipefail

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; BLUE=$'\033[0;34m'
YELLOW=$'\033[1;33m'; DIM=$'\033[2m'; NC=$'\033[0m'

step()    { echo; echo "${BLUE}==> $1${NC}"; }
ok()      { echo "${GREEN}    ok${NC} $1"; }
warn()    { echo "${YELLOW}    warning${NC} $1"; }
fail()    { echo "${RED}    error${NC} $1" >&2; exit 1; }
preview() { jq -C "$1" <<<"$2" | head -n "${3:-30}"; }

# --- Prerequisites ---------------------------------------------------------

command -v jq >/dev/null || fail "jq is not installed (brew install jq)"
command -v curl >/dev/null || fail "curl is not installed"

ENV_FILE="${ENV_FILE:-.env.local}"
[[ -f "$ENV_FILE" ]] || fail "$ENV_FILE not found. Run: cp .env.example .env.local"

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

: "${UBER_CLIENT_ID:?must be set in $ENV_FILE}"
: "${UBER_CLIENT_SECRET:?must be set in $ENV_FILE}"

APP_URL="${NEXT_PUBLIC_APP_URL:-http://localhost:3000}"
REDIRECT_URI="${UBER_REDIRECT_URI:-${APP_URL}/auth/callback}"
AUTH_BASE_URL="${UBER_AUTH_BASE_URL:-https://auth.uber.com}"
API_BASE_URL="${UBER_API_BASE_URL:-https://api.uber.com}"
SCOPES="${UBER_SCOPES:-ads.ad-accounts.read ads.campaigns.read ads.campaigns.write ads.products.read ads.reporting}"

# Fails the script if the API returned an error envelope instead of data.
check() {
  local label="$1" body="$2"
  if jq -e 'objects | has("code") and has("message")' <<<"$body" >/dev/null 2>&1; then
    echo "$body" | jq . >&2
    fail "$label failed"
  fi
}

api_get() {
  curl -sS -X GET "${API_BASE_URL}$1" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H 'Accept: application/json'
}

api_post() {
  curl -sS -X POST "${API_BASE_URL}$1" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H 'Content-Type: application/json' \
    -d "$2"
}

# --- 1. Authorize ----------------------------------------------------------

step "1. Authorize"

STATE=$(openssl rand -hex 16)
# jq -r @uri percent-encodes the scope list and redirect URI correctly.
ENCODED_SCOPES=$(jq -rn --arg s "$SCOPES" '$s|@uri')
ENCODED_REDIRECT=$(jq -rn --arg s "$REDIRECT_URI" '$s|@uri')

AUTH_URL="${AUTH_BASE_URL}/oauth/v2/authorize?response_type=code&client_id=${UBER_CLIENT_ID}&redirect_uri=${ENCODED_REDIRECT}&scope=${ENCODED_SCOPES}&state=${STATE}"

echo "    Open this URL and approve access:"
echo "${DIM}    ${AUTH_URL}${NC}"
command -v open >/dev/null && open "$AUTH_URL" 2>/dev/null || true

echo
read -r -p "    Paste the full redirect URL you land on: " REDIRECT_URL
[[ -n "$REDIRECT_URL" ]] || fail "redirect URL is required"

CODE=$(sed -n 's/.*[?&]code=\([^&#]*\).*/\1/p' <<<"$REDIRECT_URL")
RETURNED_STATE=$(sed -n 's/.*[?&]state=\([^&#]*\).*/\1/p' <<<"$REDIRECT_URL")

[[ -n "$CODE" ]] || fail "no authorization code found in the URL"
[[ "$RETURNED_STATE" == "$STATE" ]] || fail "state mismatch (expected $STATE, got $RETURNED_STATE)"
ok "authorization code received, state verified"

# --- 2. Exchange the code for tokens ---------------------------------------

step "2. Exchange code for tokens"

TOKENS=$(curl -sS -X POST "${AUTH_BASE_URL}/oauth/v2/token" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode "client_id=${UBER_CLIENT_ID}" \
  --data-urlencode "client_secret=${UBER_CLIENT_SECRET}" \
  --data-urlencode "grant_type=authorization_code" \
  --data-urlencode "redirect_uri=${REDIRECT_URI}" \
  --data-urlencode "code=${CODE}")

jq -e '.error' <<<"$TOKENS" >/dev/null && { jq . <<<"$TOKENS" >&2; fail "token exchange failed"; }

ACCESS_TOKEN=$(jq -r '.access_token' <<<"$TOKENS")
REFRESH_TOKEN=$(jq -r '.refresh_token // empty' <<<"$TOKENS")
ok "access token expires in $(jq -r '.expires_in' <<<"$TOKENS")s"
ok "granted scopes: $(jq -r '.scope // "unknown"' <<<"$TOKENS")"

# --- 3. Ad accounts --------------------------------------------------------

step "3. GET /v1/ads/ad-accounts"

ACCOUNTS=$(api_get "/v1/ads/ad-accounts")
check "get ad accounts" "$ACCOUNTS"

ACCOUNT_ID=$(jq -r '.ad_accounts[0].ad_account_id // empty' <<<"$ACCOUNTS")
[[ -n "$ACCOUNT_ID" ]] || fail "this token has access to no ad accounts"
ok "$(jq -r '.ad_accounts | length' <<<"$ACCOUNTS") account(s); using $(jq -r '.ad_accounts[0].name' <<<"$ACCOUNTS")"
preview '.ad_accounts[0]' "$ACCOUNTS"

# --- 4. Stores -------------------------------------------------------------

step "4. GET /v1/ads/{ad_account_id}/stores"

STORES=$(api_get "/v1/ads/${ACCOUNT_ID}/stores?page_limit=5")
check "get stores" "$STORES"
ok "$(jq -r '.stores // [] | length' <<<"$STORES") store(s) on this page"
preview '.stores[:2]' "$STORES"

# --- 5. Campaigns ----------------------------------------------------------

step "5. GET /v1/ads/{account_id}/campaigns"

CAMPAIGNS=$(api_get "/v1/ads/${ACCOUNT_ID}/campaigns?page_limit=5")
check "get campaigns" "$CAMPAIGNS"

CAMPAIGN_COUNT=$(jq -r '.campaigns // [] | length' <<<"$CAMPAIGNS")
ok "$CAMPAIGN_COUNT campaign(s) on this page"
preview '.campaigns[:1]' "$CAMPAIGNS"

# Pagination cursors are objects, so the token lives at .next_page_token.value.
NEXT_PAGE=$(jq -r '.next_page_token.value // empty' <<<"$CAMPAIGNS")
[[ -n "$NEXT_PAGE" ]] && ok "more pages available; pass page_token=${NEXT_PAGE:0:16}..."

# --- 6. Ad groups and ads --------------------------------------------------

if [[ "$CAMPAIGN_COUNT" -gt 0 ]]; then
  CAMPAIGN_ID=$(jq -r '.campaigns[0].campaign_id' <<<"$CAMPAIGNS")

  step "6. GET /v1/ads/{account_id}/campaigns/{campaign_id}/ad-groups"

  AD_GROUPS=$(api_get "/v1/ads/${ACCOUNT_ID}/campaigns/${CAMPAIGN_ID}/ad-groups?page_limit=5")
  check "get ad groups" "$AD_GROUPS"

  AD_GROUP_COUNT=$(jq -r '.ad_groups // [] | length' <<<"$AD_GROUPS")
  ok "$AD_GROUP_COUNT ad group(s)"
  preview '.ad_groups[:1]' "$AD_GROUPS"

  if [[ "$AD_GROUP_COUNT" -gt 0 ]]; then
    AD_GROUP_ID=$(jq -r '.ad_groups[0].ad_group_id' <<<"$AD_GROUPS")

    step "7. GET .../ad-groups/{ad_group_id}/ads"

    ADS=$(api_get "/v1/ads/${ACCOUNT_ID}/campaigns/${CAMPAIGN_ID}/ad-groups/${AD_GROUP_ID}/ads?page_limit=5")
    check "get ads" "$ADS"
    ok "$(jq -r '.ads // [] | length' <<<"$ADS") ad(s)"
    preview '.ads[:3]' "$ADS"
  fi
else
  warn "no campaigns in this account; skipping ad groups and ads"
fi

# --- 8. Products -----------------------------------------------------------

step "8. GET /v1/ads/{account_id}/products"

PRODUCTS=$(api_get "/v1/ads/${ACCOUNT_ID}/products?page_limit=5")
check "get products" "$PRODUCTS"
ok "$(jq -r '.products // [] | length' <<<"$PRODUCTS") product(s) on this page"

# --- 9. Sync report --------------------------------------------------------

step "9. POST /v1/ads/{account_id}/reporting/sync"

# Sync reports allow at most 30 days at DAILY granularity.
if date -u -v-7d >/dev/null 2>&1; then
  START=$(date -u -v-7d +%Y-%m-%dT00:00:00Z)   # BSD date (macOS)
else
  START=$(date -u -d '7 days ago' +%Y-%m-%dT00:00:00Z)  # GNU date (Linux)
fi
END=$(date -u +%Y-%m-%dT00:00:00Z)

REPORT=$(api_post "/v1/ads/${ACCOUNT_ID}/reporting/sync" "$(jq -n \
  --arg start "$START" --arg end "$END" '{
    report_type: "AD_PERFORMANCE",
    time_range: { start_time: $start, end_time: $end },
    columns: ["campaign_id", "impressions", "clicks", "ad_spend"],
    time_unit: "DAILY"
  }')")

check "sync report" "$REPORT"
ok "$(jq -r '.data.rows // [] | length' <<<"$REPORT") row(s) returned"
preview '{columns: [.schema.columns[]?.name], rows: (.data.rows[:5] // [])}' "$REPORT"

# --- 10. Async report ------------------------------------------------------

step "10. POST /reporting/report, then poll GET /reporting/{report_id}"

JOB=$(api_post "/v1/ads/${ACCOUNT_ID}/reporting/report" "$(jq -n \
  --arg start "$START" --arg end "$END" '{
    report_type: "AD_PERFORMANCE",
    time_range: { start_time: $start, end_time: $end },
    columns: ["campaign_id", "ad_group_id", "impressions", "clicks", "ad_spend"],
    time_unit: "SUMMARY",
    file_format: "CSV"
  }')")

check "create report" "$JOB"
REPORT_ID=$(jq -r '.report_id // empty' <<<"$JOB")
[[ -n "$REPORT_ID" ]] || fail "no report_id returned"
ok "queued report $REPORT_ID"

# The status endpoint allows one request every 10 seconds.
REPORT_URL=""
for attempt in $(seq 1 30); do
  sleep 10
  STATUS_BODY=$(api_get "/v1/ads/${ACCOUNT_ID}/reporting/${REPORT_ID}")
  check "get report" "$STATUS_BODY"
  STATUS=$(jq -r '.status // "PROCESSING"' <<<"$STATUS_BODY")
  echo "${DIM}    attempt ${attempt}: ${STATUS}${NC}"

  case "$STATUS" in
    COMPLETED)
      REPORT_URL=$(jq -r '.result.success_result.report_url // empty' <<<"$STATUS_BODY")
      break
      ;;
    FAILED)
      fail "report failed: $(jq -r '.result.failure_result.failure_reason // "no reason given"' <<<"$STATUS_BODY")"
      ;;
  esac
done

if [[ -n "$REPORT_URL" ]]; then
  ok "CSV ready: ${REPORT_URL:0:60}..."
  ok "columns: $(jq -r '(.result.success_result.report_schema // []) | join(", ")' <<<"$STATUS_BODY")"
else
  warn "report did not finish within 5 minutes; poll $REPORT_ID again later"
fi

# --- 11. Create a campaign, ad group and ad --------------------------------
#
# Writes are skipped unless CREATE=1, so the walkthrough is read-only by
# default. Everything it creates is paused and never spends.

if [[ "${CREATE:-0}" == "1" ]]; then
  step "11. POST campaigns, ad-groups and ads"

  ACCOUNT_TYPE=$(jq -r '.ad_accounts[0].account_type // "UNKNOWN"' <<<"$ACCOUNTS")
  STORE_ID=$(jq -r '.stores[0].id // empty' <<<"$STORES")
  [[ -n "$STORE_ID" ]] || fail "no stores in this account; an ad group needs at least one"

  # Only OFD accounts may run Sponsored Search; USER_STORES_GROUP is limited to
  # Sponsored Listing. Anything else cannot create campaigns at all.
  case "$ACCOUNT_TYPE" in
    OFD)               AD_PRODUCT="SPONSORED_SEARCH" ;;
    USER_STORES_GROUP) AD_PRODUCT="SPONSORED_LISTING" ;;
    *) fail "$ACCOUNT_TYPE accounts cannot create campaigns (see /docs/ads/campaign-management/ad-products)" ;;
  esac
  ok "account type $ACCOUNT_TYPE, using $AD_PRODUCT"

  # Batch writes report per-item failures inside a 200, so check .results.
  batch_id() {
    local label="$1" body="$2"
    if jq -e '.results[0].failure' <<<"$body" >/dev/null 2>&1; then
      fail "$label: $(jq -r '.results[0].failure | "\(.error_code): \(.error_message)"' <<<"$body")"
    fi
    jq -r '.results[0].success.id' <<<"$body"
  }

  CREATED=$(api_post "/v1/ads/${ACCOUNT_ID}/campaigns" "$(jq -n '{
    campaigns: [{
      name: "Example campaign (script)",
      configured_status: "CAMPAIGN_CONFIGURED_STATUS_PAUSED",
      budget: { unit: "BUDGET_UNIT_DAILY", total: { amount_e5: "2500000", currency_code: "USD" } }
    }]
  }')")
  check "create campaign" "$CREATED"
  NEW_CAMPAIGN_ID=$(batch_id "create campaign" "$CREATED")
  ok "campaign $NEW_CAMPAIGN_ID"

  # Sponsored Search matches the customer's query, so it targets keywords.
  # Sponsored Listing has no query, so it targets audiences instead.
  if [[ "$AD_PRODUCT" == "SPONSORED_SEARCH" ]]; then
    TARGETING='{ negation: false, operator: "AND", criteria: [{ keyword_targeting: { keywords: ["pizza", "late night delivery"], match_type: "BROAD" } }] }'
  else
    TARGETING='{ negation: false, operator: "AND", criteria: [{ new_to_brand: {} }] }'
  fi

  CREATED=$(api_post "/v1/ads/${ACCOUNT_ID}/campaigns/${NEW_CAMPAIGN_ID}/ad-groups" "$(jq -n \
    --arg product "$AD_PRODUCT" --arg store "$STORE_ID" --arg start "$END" \
    --argjson targeting "$(jq -n "$TARGETING")" '{
      ad_groups: [{
        name: "Example ad group (script)",
        ad_product: $product,
        configured_status: "AD_GROUP_CONFIGURED_STATUS_PAUSED",
        schedule: { start_time: $start },
        bidding: { auto: {} },
        targeting: $targeting,
        ad_subjects: { stores: { store_ids: [$store] } }
      }]
    }')")
  check "create ad group" "$CREATED"
  NEW_AD_GROUP_ID=$(batch_id "create ad group" "$CREATED")
  ok "ad group $NEW_AD_GROUP_ID"

  # An ad is only a name; Uber attaches a default creative. Without one the ad
  # group will not serve.
  CREATED=$(api_post "/v1/ads/${ACCOUNT_ID}/campaigns/${NEW_CAMPAIGN_ID}/ad-groups/${NEW_AD_GROUP_ID}/ads" \
    "$(jq -n '{ ads: [{ name: "Example ad (script)" }] }')")
  check "create ad" "$CREATED"
  ok "ad $(batch_id "create ad" "$CREATED")"
else
  step "11. Create campaign, ad group and ad"
  warn "skipped; re-run with CREATE=1 to create a paused example campaign"
fi

# --- 12. Refresh the access token ------------------------------------------

if [[ -n "$REFRESH_TOKEN" ]]; then
  step "12. Refresh the access token"

  REFRESHED=$(curl -sS -X POST "${AUTH_BASE_URL}/oauth/v2/token" \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    --data-urlencode "client_id=${UBER_CLIENT_ID}" \
    --data-urlencode "client_secret=${UBER_CLIENT_SECRET}" \
    --data-urlencode "grant_type=refresh_token" \
    --data-urlencode "refresh_token=${REFRESH_TOKEN}")

  if jq -e '.error' <<<"$REFRESHED" >/dev/null; then
    warn "refresh failed: $(jq -r '.error' <<<"$REFRESHED")"
  else
    ok "new access token expires in $(jq -r '.expires_in' <<<"$REFRESHED")s"
  fi
fi

step "Done"
echo "    Account:   $ACCOUNT_ID"
echo "    Campaigns: $CAMPAIGN_COUNT"
echo
echo "${DIM}    Tokens were not written to disk. Re-run the script to get new ones.${NC}"
