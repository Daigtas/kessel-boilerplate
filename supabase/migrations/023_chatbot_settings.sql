-- Migration: Chatbot Avatar und Persönlichkeits-Einstellungen
-- Beschreibung: Fügt Spalten für Chatbot-Avatar-Seed und Persönlichkeits-Einstellungen hinzu

-- Chatbot-Avatar-Seed (für DiceBear bottts)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS chatbot_avatar_seed text;

-- Chatbot-Persönlichkeits-Einstellungen
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS chatbot_tone text DEFAULT 'casual';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS chatbot_detail_level text DEFAULT 'balanced';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS chatbot_emoji_usage text DEFAULT 'moderate';

-- Constraints für Validierung
DO $$
BEGIN
  -- chatbot_tone Constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chatbot_tone_check'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT chatbot_tone_check 
      CHECK (chatbot_tone IN ('formal', 'casual'));
  END IF;

  -- chatbot_detail_level Constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chatbot_detail_level_check'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT chatbot_detail_level_check 
      CHECK (chatbot_detail_level IN ('brief', 'balanced', 'detailed'));
  END IF;

  -- chatbot_emoji_usage Constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chatbot_emoji_usage_check'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT chatbot_emoji_usage_check 
      CHECK (chatbot_emoji_usage IN ('none', 'moderate', 'many'));
  END IF;
END $$;

-- Kommentare für Dokumentation
COMMENT ON COLUMN profiles.chatbot_avatar_seed IS 'Seed für DiceBear bottts Avatar (Robots-Serie)';
COMMENT ON COLUMN profiles.chatbot_tone IS 'Ansprache: formal (Sie) oder casual (Du)';
COMMENT ON COLUMN profiles.chatbot_detail_level IS 'Detailgrad: brief, balanced oder detailed';
COMMENT ON COLUMN profiles.chatbot_emoji_usage IS 'Emoji-Verwendung: none, moderate oder many';

