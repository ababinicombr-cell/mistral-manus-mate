
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

-- restrict artifacts bucket: keep public read of individual objects via signed/direct URL only by owner folder listing
DROP POLICY IF EXISTS "artifacts_public_read" ON storage.objects;
CREATE POLICY "artifacts_owner_or_direct_read" ON storage.objects FOR SELECT
  USING (
    bucket_id='artifacts' AND (
      auth.uid() IS NOT NULL AND auth.uid()::text=(storage.foldername(name))[1]
    )
  );
