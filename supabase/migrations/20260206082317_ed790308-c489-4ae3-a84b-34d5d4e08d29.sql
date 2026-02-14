-- Create storage bucket for technical sheet images
INSERT INTO storage.buckets (id, name, public)
VALUES ('technical-sheet-images', 'technical-sheet-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for finished production images
INSERT INTO storage.buckets (id, name, public)
VALUES ('finished-production-images', 'finished-production-images', true)
ON CONFLICT (id) DO NOTHING;

-- Add image_url column to finished_productions_stock if not exists
ALTER TABLE public.finished_productions_stock 
ADD COLUMN IF NOT EXISTS image_url text;

-- RLS policies for technical-sheet-images bucket
CREATE POLICY "Public can view technical sheet images"
ON storage.objects FOR SELECT
USING (bucket_id = 'technical-sheet-images');

CREATE POLICY "Authenticated users can upload technical sheet images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'technical-sheet-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update technical sheet images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'technical-sheet-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete technical sheet images"
ON storage.objects FOR DELETE
USING (bucket_id = 'technical-sheet-images' AND auth.role() = 'authenticated');

-- RLS policies for finished-production-images bucket
CREATE POLICY "Public can view finished production images"
ON storage.objects FOR SELECT
USING (bucket_id = 'finished-production-images');

CREATE POLICY "Authenticated users can upload finished production images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'finished-production-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update finished production images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'finished-production-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete finished production images"
ON storage.objects FOR DELETE
USING (bucket_id = 'finished-production-images' AND auth.role() = 'authenticated');