//! Scryfall API client.
//!
//! Scryfall asks every client to send a User-Agent and an Accept header and to
//! keep to its rate limits: about 10 requests per second in general and 2 per
//! second for card searches. Every call goes through one shared client that
//! spaces requests accordingly. If Scryfall still answers 429 (too many
//! requests), the client stops sending anything until the wait is over.
//! https://scryfall.com/docs/api/rate-limits

use std::time::{Duration, Instant};

use serde_json::Value;
use tokio::sync::Mutex;

const BASE: &str = "https://api.scryfall.com";
const MIN_GAP: Duration = Duration::from_millis(100);
/// Card searches are limited to 2 per second.
const SEARCH_GAP: Duration = Duration::from_millis(550);
/// How long to back off after a 429 when Scryfall doesn't say.
const BACKOFF: Duration = Duration::from_secs(60);

struct Pacing {
    last_request: Option<Instant>,
    last_search: Option<Instant>,
    blocked_until: Option<Instant>,
}

pub struct Scryfall {
    http: reqwest::Client,
    pacing: Mutex<Pacing>,
}

impl Scryfall {
    pub fn new() -> Self {
        let http = reqwest::Client::builder()
            .user_agent(concat!("Table/", env!("CARGO_PKG_VERSION"), " (desktop MTG deckbuilder)"))
            .build()
            .expect("failed to build HTTP client");
        Self { http, pacing: Mutex::new(Pacing { last_request: None, last_search: None, blocked_until: None }) }
    }

    async fn get(&self, path: &str, query: &[(&str, String)]) -> Result<Value, String> {
        let is_search = path == "/cards/search";
        {
            // Held while waiting, so requests go out one at a time, in order.
            let mut pacing = self.pacing.lock().await;
            if let Some(until) = pacing.blocked_until {
                let now = Instant::now();
                if now < until {
                    let secs = (until - now).as_secs() + 1;
                    return Err(format!("Scryfall asked Table to slow down. Searching again in {secs} s."));
                }
                pacing.blocked_until = None;
            }
            let wait = |at: Option<Instant>, gap: Duration| at.map_or(Duration::ZERO, |t| gap.saturating_sub(t.elapsed()));
            let mut delay = wait(pacing.last_request, MIN_GAP);
            if is_search {
                delay = delay.max(wait(pacing.last_search, SEARCH_GAP));
            }
            if !delay.is_zero() {
                tokio::time::sleep(delay).await;
            }
            let now = Instant::now();
            pacing.last_request = Some(now);
            if is_search {
                pacing.last_search = Some(now);
            }
        }

        let response = self
            .http
            .get(format!("{BASE}{path}"))
            .header("Accept", "application/json")
            .query(query)
            .send()
            .await
            .map_err(|e| format!("Couldn't reach Scryfall: {e}"))?;

        let status = response.status();
        if status == reqwest::StatusCode::TOO_MANY_REQUESTS {
            let retry = response
                .headers()
                .get(reqwest::header::RETRY_AFTER)
                .and_then(|v| v.to_str().ok())
                .and_then(|v| v.parse::<u64>().ok())
                .map_or(BACKOFF, Duration::from_secs);
            self.pacing.lock().await.blocked_until = Some(Instant::now() + retry);
            return Err(format!("Scryfall asked Table to slow down. Searching again in {} s.", retry.as_secs()));
        }
        let body: Value = response.json().await.map_err(|e| format!("Bad response from Scryfall: {e}"))?;

        // A search with no matches is a 404 with an error object; report it as an empty list.
        if status == reqwest::StatusCode::NOT_FOUND && is_search {
            return Ok(serde_json::json!({ "object": "list", "data": [], "has_more": false, "total_cards": 0 }));
        }
        if !status.is_success() {
            let details = body.get("details").and_then(Value::as_str).unwrap_or("unknown error");
            return Err(format!("Scryfall error ({status}): {details}"));
        }
        Ok(body)
    }

    pub async fn search(&self, query: String, unique: String, order: String, dir: String, page: u32) -> Result<Value, String> {
        self.get(
            "/cards/search",
            &[("q", query), ("unique", unique), ("order", order), ("dir", dir), ("page", page.to_string())],
        )
        .await
    }

    pub async fn sets(&self) -> Result<Value, String> {
        self.get("/sets", &[]).await
    }
}
