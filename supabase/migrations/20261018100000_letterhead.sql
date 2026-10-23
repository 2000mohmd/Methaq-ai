-- Firm letterhead used on exported Word documents (name, address, contact, CR no.).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS letterhead jsonb;
