-- PHASE 2: ENHANCED SUPPLIER MANAGEMENT AND WHATSAPP INTEGRATION

-- 1. Add new fields to suppliers table
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS cnpj_cpf VARCHAR(18);
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS delivery_time_days INTEGER;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS state VARCHAR(2);
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS zip_code VARCHAR(9);
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(20);

-- Update existing records to ensure whatsapp_number is synced if whatsapp exists
UPDATE public.suppliers SET whatsapp_number = whatsapp WHERE whatsapp_number IS NULL AND whatsapp IS NOT NULL;

-- 2. Create table for automatic supplier messages
CREATE TABLE IF NOT EXISTS public.supplier_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  purchase_list_id UUID REFERENCES public.purchase_list_items(id),
  message_text TEXT NOT NULL,
  whatsapp_status TEXT DEFAULT 'pending', -- pending, sent, delivered, failed
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Add RLS policies for supplier_messages
ALTER TABLE public.supplier_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own supplier messages"
  ON public.supplier_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own supplier messages"
  ON public.supplier_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own supplier messages"
  ON public.supplier_messages FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own supplier messages"
  ON public.supplier_messages FOR DELETE
  USING (auth.uid() = user_id);

-- 4. Comments for documentation
COMMENT ON COLUMN public.suppliers.cnpj_cpf IS 'CNPJ ou CPF do fornecedor para validação';
COMMENT ON COLUMN public.suppliers.whatsapp_number IS 'Número do WhatsApp formatado para envio de mensagens automáticas';
COMMENT ON TABLE public.supplier_messages IS 'Registro de mensagens enviadas ou pendentes para fornecedores via WhatsApp';
