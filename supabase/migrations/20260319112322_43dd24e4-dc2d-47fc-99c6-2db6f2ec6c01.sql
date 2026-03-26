-- Add recipient fields to support_conversations for user-to-user chat
ALTER TABLE public.support_conversations 
  ADD COLUMN IF NOT EXISTS recipient_id uuid,
  ADD COLUMN IF NOT EXISTS recipient_name text,
  ADD COLUMN IF NOT EXISTS recipient_email text,
  ADD COLUMN IF NOT EXISTS conversation_type text NOT NULL DEFAULT 'support';

-- Update RLS policies to allow users to see conversations where they are the recipient
DROP POLICY IF EXISTS "Users see own conversations" ON public.support_conversations;
CREATE POLICY "Users see own conversations" ON public.support_conversations
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR recipient_id = auth.uid() OR (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.email = 'jeanallbuquerque@gmail.com'
  )));

DROP POLICY IF EXISTS "Users update own conversations" ON public.support_conversations;
CREATE POLICY "Users update own conversations" ON public.support_conversations
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR recipient_id = auth.uid() OR (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.email = 'jeanallbuquerque@gmail.com'
  )));

-- Update support_messages RLS to allow participants of the conversation
DROP POLICY IF EXISTS "Users see messages of own conversations" ON public.support_messages;
CREATE POLICY "Users see messages of own conversations" ON public.support_messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM support_conversations sc
    WHERE sc.id = support_messages.conversation_id
    AND (sc.user_id = auth.uid() OR sc.recipient_id = auth.uid() OR EXISTS (
      SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.email = 'jeanallbuquerque@gmail.com'
    ))
  ));

DROP POLICY IF EXISTS "Users insert messages in own conversations" ON public.support_messages;
CREATE POLICY "Users insert messages in own conversations" ON public.support_messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND EXISTS (
    SELECT 1 FROM support_conversations sc
    WHERE sc.id = support_messages.conversation_id
    AND (sc.user_id = auth.uid() OR sc.recipient_id = auth.uid() OR EXISTS (
      SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.email = 'jeanallbuquerque@gmail.com'
    ))
  ));