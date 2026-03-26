-- Argeon Database Health Check
-- Run via: supabase db query --linked -f supabase/scripts/healthcheck.sql

-- 1. Total counts
SELECT 'COUNTS' as check_type,
  (SELECT count(*) FROM auth.users) as total_users,
  (SELECT count(*) FROM encrypted_keys) as total_keys,
  (SELECT count(*) FROM preferences) as total_preferences,
  (SELECT count(*) FROM synced_history) as total_history_entries;

-- 2. Orphaned keys (user deleted but keys remain — should not happen with CASCADE)
SELECT 'ORPHANED_KEYS' as check_type, ek.id, ek.provider_id, ek.user_id
FROM encrypted_keys ek
LEFT JOIN auth.users u ON u.id = ek.user_id
WHERE u.id IS NULL;

-- 3. Orphaned preferences
SELECT 'ORPHANED_PREFERENCES' as check_type, p.user_id
FROM preferences p
LEFT JOIN auth.users u ON u.id = p.user_id
WHERE u.id IS NULL;

-- 4. Orphaned history
SELECT 'ORPHANED_HISTORY' as check_type, sh.id, sh.user_id, sh.device_id
FROM synced_history sh
LEFT JOIN auth.users u ON u.id = sh.user_id
WHERE u.id IS NULL;

-- 5. Keys with invalid provider IDs (not in our known set)
SELECT 'UNKNOWN_PROVIDER_KEYS' as check_type, id, provider_id, user_id
FROM encrypted_keys
WHERE provider_id NOT IN ('openai', 'anthropic', 'gemini', 'xai');

-- 6. Keys with empty or missing encryption data (likely plaintext or corrupt)
SELECT 'SUSPECT_ENCRYPTION' as check_type, id, provider_id, user_id,
  CASE
    WHEN iv = '' OR iv IS NULL THEN 'missing_iv'
    WHEN length(encrypted_key) < 10 THEN 'suspiciously_short'
    ELSE 'ok'
  END as issue
FROM encrypted_keys
WHERE iv = '' OR iv IS NULL OR length(encrypted_key) < 10;

-- 7. Duplicate keys per user+provider (should be impossible with UNIQUE constraint)
SELECT 'DUPLICATE_KEYS' as check_type, user_id, provider_id, count(*) as copies
FROM encrypted_keys
GROUP BY user_id, provider_id
HAVING count(*) > 1;

-- 8. History entries with empty responses (incomplete syncs)
SELECT 'EMPTY_HISTORY_RESPONSES' as check_type, id, user_id, query, device_id
FROM synced_history
WHERE responses = '[]'::jsonb OR responses IS NULL;

-- 9. Users with auth account but no data anywhere (potential cleanup candidates)
SELECT 'USERS_NO_DATA' as check_type, u.id as user_id, u.email,
  u.created_at as user_created
FROM auth.users u
LEFT JOIN encrypted_keys ek ON ek.user_id = u.id
LEFT JOIN preferences p ON p.user_id = u.id
LEFT JOIN synced_history sh ON sh.user_id = u.id
WHERE ek.id IS NULL AND p.user_id IS NULL AND sh.id IS NULL;

-- 10. Preferences with unknown judge provider
SELECT 'INVALID_JUDGE_PROVIDER' as check_type, user_id, judge_provider
FROM preferences
WHERE judge_provider IS NOT NULL
  AND judge_provider NOT IN ('openai', 'anthropic', 'gemini', 'xai');

-- 11. Preferences with unknown proxy providers
SELECT 'INVALID_PROXY_PROVIDERS' as check_type, user_id, proxy_providers
FROM preferences
WHERE proxy_providers != '{}'
  AND NOT (proxy_providers <@ ARRAY['openai', 'anthropic', 'gemini', 'xai']);

-- 12. History entries per user (spot abnormally large histories)
SELECT 'HISTORY_PER_USER' as check_type, user_id, count(*) as entry_count
FROM synced_history
GROUP BY user_id
ORDER BY entry_count DESC
LIMIT 10;
