-- Supersession status so the assistant never presents a repealed provision as current law.
ALTER TABLE public.library_items ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'in_force'
  CHECK (status IN ('in_force','amended','repealed'));
