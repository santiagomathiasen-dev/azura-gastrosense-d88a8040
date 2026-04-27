-- Add video_url to technical_sheets
ALTER TABLE public.technical_sheets 
ADD COLUMN video_url TEXT;

-- Add video_url to technical_sheet_stages
ALTER TABLE public.technical_sheet_stages 
ADD COLUMN video_url TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.technical_sheets.video_url IS 'URL for YouTube or Instagram video demonstrating the technique';
COMMENT ON COLUMN public.technical_sheet_stages.video_url IS 'URL for a video specific to this stage';
