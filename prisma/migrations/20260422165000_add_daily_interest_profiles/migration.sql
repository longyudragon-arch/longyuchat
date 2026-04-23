CREATE TABLE IF NOT EXISTS daily_interest_profiles (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  include_keywords_json TEXT,
  exclude_keywords_json TEXT,
  interests_text TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 100,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS daily_interest_profiles_name_key ON daily_interest_profiles(name);
CREATE INDEX IF NOT EXISTS daily_interest_profiles_enabled_priority_idx ON daily_interest_profiles(enabled, priority);
