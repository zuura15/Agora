-- Access Code System
-- Provides credit-based access for users without their own API keys

-- Admin check function
-- Reads from DB-level setting: ALTER DATABASE postgres SET app.admin_email = 'owner@example.com'
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT (auth.jwt() ->> 'email') = current_setting('app.admin_email', true);
$$;

-- Access codes table
CREATE TABLE access_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  initial_credit numeric(10, 6) NOT NULL CHECK (initial_credit > 0),
  remaining_credit numeric(10, 6) NOT NULL CHECK (remaining_credit >= 0),
  redeemed_by text,
  redeemed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  blocked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  redeemed_at timestamptz
);

CREATE INDEX idx_access_codes_user_active ON access_codes (redeemed_by_user_id)
  WHERE remaining_credit > 0 AND blocked = false AND redeemed_by_user_id IS NOT NULL;
CREATE INDEX idx_access_codes_unredeemed ON access_codes (code)
  WHERE redeemed_by IS NULL AND blocked = false;

ALTER TABLE access_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access" ON access_codes FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Users view own codes" ON access_codes FOR SELECT
  USING (redeemed_by_user_id = auth.uid());

-- Usage log table
CREATE TABLE usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_code_id uuid NOT NULL REFERENCES access_codes(id),
  provider text NOT NULL,
  model text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  cost numeric(10, 6) NOT NULL DEFAULT 0,
  query_group_id uuid NOT NULL,
  request_id uuid NOT NULL UNIQUE,
  is_reservation boolean NOT NULL DEFAULT false,
  settled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_usage_log_user_time ON usage_log (user_id, created_at DESC);
CREATE INDEX idx_usage_log_query_group ON usage_log (query_group_id);

ALTER TABLE usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access" ON usage_log FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Users view own usage" ON usage_log FOR SELECT
  USING (user_id = auth.uid());

-- Daily usage counter (for atomic rate limiting)
CREATE TABLE daily_usage (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date date NOT NULL DEFAULT CURRENT_DATE,
  query_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, usage_date)
);

ALTER TABLE daily_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access" ON daily_usage FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Users view own" ON daily_usage FOR SELECT
  USING (user_id = auth.uid());

-- Reserve credit + claim daily slot atomically
CREATE OR REPLACE FUNCTION reserve_query(
  p_user_id uuid,
  p_estimated_cost numeric DEFAULT 0.50
)
RETURNS TABLE (
  query_group_id uuid,
  active_code_id uuid,
  total_remaining_credit numeric,
  queries_today integer,
  daily_limit integer
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_query_group_id uuid := gen_random_uuid();
  v_code_id uuid;
  v_credit numeric;
  v_queries integer;
  v_daily_limit integer := 20;
BEGIN
  SELECT COALESCE(SUM(ac.remaining_credit), 0) INTO v_credit
  FROM access_codes ac
  WHERE ac.redeemed_by_user_id = p_user_id AND ac.remaining_credit > 0 AND ac.blocked = false;

  IF v_credit <= 0 THEN
    RAISE EXCEPTION 'NO_CREDIT';
  END IF;

  INSERT INTO daily_usage (user_id, usage_date, query_count)
  VALUES (p_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, usage_date)
  DO UPDATE SET query_count = daily_usage.query_count + 1
  WHERE daily_usage.query_count < v_daily_limit
  RETURNING daily_usage.query_count INTO v_queries;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RATE_LIMITED';
  END IF;

  SELECT ac.id INTO v_code_id
  FROM access_codes ac
  WHERE ac.redeemed_by_user_id = p_user_id AND ac.remaining_credit > 0 AND ac.blocked = false
  ORDER BY ac.remaining_credit DESC LIMIT 1;

  UPDATE access_codes
  SET remaining_credit = GREATEST(remaining_credit - p_estimated_cost, 0)
  WHERE id = v_code_id;

  SELECT COALESCE(SUM(ac.remaining_credit), 0) INTO v_credit
  FROM access_codes ac
  WHERE ac.redeemed_by_user_id = p_user_id AND ac.remaining_credit >= 0 AND ac.blocked = false;

  RETURN QUERY SELECT v_query_group_id, v_code_id, v_credit, v_queries, v_daily_limit;
END;
$$;

-- Settle actual cost (called after streaming completes)
CREATE OR REPLACE FUNCTION settle_usage(
  p_user_id uuid,
  p_query_group_id uuid,
  p_code_id uuid,
  p_actual_total_cost numeric,
  p_estimated_cost numeric
)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_diff numeric;
  v_remaining numeric;
BEGIN
  v_diff := p_actual_total_cost - p_estimated_cost;

  IF v_diff > 0 THEN
    PERFORM deduct_from_codes(p_user_id, v_diff);
  ELSIF v_diff < 0 THEN
    UPDATE access_codes
    SET remaining_credit = LEAST(remaining_credit + ABS(v_diff), initial_credit)
    WHERE id = p_code_id;
  END IF;

  SELECT COALESCE(SUM(remaining_credit), 0) INTO v_remaining
  FROM access_codes
  WHERE redeemed_by_user_id = p_user_id AND remaining_credit >= 0 AND blocked = false;

  RETURN v_remaining;
END;
$$;

-- Helper: deduct across multiple codes (spillover)
CREATE OR REPLACE FUNCTION deduct_from_codes(p_user_id uuid, p_amount numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_remaining_to_deduct numeric := p_amount;
  v_code RECORD;
BEGIN
  FOR v_code IN
    SELECT id, remaining_credit
    FROM access_codes
    WHERE redeemed_by_user_id = p_user_id AND remaining_credit > 0 AND blocked = false
    ORDER BY remaining_credit DESC
  LOOP
    IF v_remaining_to_deduct <= 0 THEN EXIT; END IF;

    IF v_code.remaining_credit >= v_remaining_to_deduct THEN
      UPDATE access_codes SET remaining_credit = remaining_credit - v_remaining_to_deduct WHERE id = v_code.id;
      v_remaining_to_deduct := 0;
    ELSE
      UPDATE access_codes SET remaining_credit = 0 WHERE id = v_code.id;
      v_remaining_to_deduct := v_remaining_to_deduct - v_code.remaining_credit;
    END IF;
  END LOOP;
END;
$$;

-- Atomic redemption with max-3 enforcement
CREATE OR REPLACE FUNCTION redeem_code(
  p_user_id uuid,
  p_user_email text,
  p_code_id uuid
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_active_count integer;
BEGIN
  SELECT COUNT(*) INTO v_active_count
  FROM access_codes
  WHERE redeemed_by_user_id = p_user_id AND remaining_credit > 0 AND blocked = false
  FOR UPDATE;

  IF v_active_count >= 3 THEN
    RAISE EXCEPTION 'MAX_CODES_REACHED';
  END IF;

  UPDATE access_codes
  SET redeemed_by = p_user_email,
      redeemed_by_user_id = p_user_id,
      redeemed_at = now()
  WHERE id = p_code_id AND redeemed_by IS NULL AND blocked = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CODE_UNAVAILABLE';
  END IF;

  RETURN true;
END;
$$;

-- Revoke direct RPC access to sensitive functions
REVOKE EXECUTE ON FUNCTION reserve_query FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION settle_usage FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION deduct_from_codes FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION redeem_code FROM anon, authenticated;
