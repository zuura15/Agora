ALTER TABLE preferences ADD COLUMN IF NOT EXISTS temperature real DEFAULT 0.7;
ALTER TABLE preferences ADD COLUMN IF NOT EXISTS auto_judge boolean DEFAULT false;
ALTER TABLE preferences ADD COLUMN IF NOT EXISTS column_layout text DEFAULT 'auto';
