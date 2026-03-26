-- Encrypted API keys
CREATE TABLE encrypted_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id text NOT NULL,
  encrypted_key text NOT NULL,
  iv text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, provider_id)
);

ALTER TABLE encrypted_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD their own keys"
  ON encrypted_keys FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- User preferences
CREATE TABLE preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  selected_models jsonb DEFAULT '{}'::jsonb,
  theme text DEFAULT 'dark',
  judge_provider text,
  history_sync_enabled boolean DEFAULT false,
  proxy_providers text[] DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD their own preferences"
  ON preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Synced query history
CREATE TABLE synced_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  local_id integer NOT NULL,
  device_id text NOT NULL,
  query text NOT NULL,
  timestamp bigint NOT NULL,
  responses jsonb DEFAULT '[]'::jsonb,
  files text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, device_id, local_id)
);

ALTER TABLE synced_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD their own history"
  ON synced_history FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
