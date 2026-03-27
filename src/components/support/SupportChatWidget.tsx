import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { MessageCircle, X, Send, Paperclip, Loader2, ArrowLeft, Users, Headphones, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  content: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  created_at: string;
}

interface Conversation {
  id: string;
  user_id: string;
  recipient_id: string | null;
  recipient_name: string | null;
  user_name: string;
  user_email: string;
  status: string;
  subject: string;
  conversation_type: string;
  last_message_at: string;
}

interface UserProfile {
  user_id: string;
  nome: string;
  email: string;
  tipo: string;
  status: string;
}

type Screen = 'list' | 'chat' | 'new-chat' | 'user-select';

export default function SupportChatWidget() {
  return <ChatWidget />;
}

function ChatWidget() {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [screen, setScreen] = useState<Screen>('list');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [totalUnread, setTotalUnread] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Track which conversations have unread messages
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});

  // Load all conversations for this user
  const loadConversations = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('support_conversations')
        .select('*')
        .or(`user_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order('last_message_at', { ascending: false });
      if (data) setConversations(data as any);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const loadMessages = async (convId: string) => {
    const { data } = await supabase
      .from('support_messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });
    if (data) setMessages(data as any);
  };

  const loadUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('user_id, nome, email, tipo, status')
      .eq('status', 'ativo')
      .order('nome');
    if (data) setUsers(data.filter(u => u.user_id !== user?.id) as any);
  };

  useEffect(() => {
    if (open) {
      loadConversations();
      setScreen('list');
    }
  }, [open, loadConversations]);

  // Global realtime: listen for ALL new messages for this user's conversations
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('user-chat-global')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'support_messages',
      }, (payload) => {
        const newMsg = payload.new as Message;
        // If in active conversation, add to messages
        if (activeConv && newMsg.conversation_id === activeConv.id) {
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
        // If message is from someone else, increment unread
        if (newMsg.sender_id !== user.id) {
          // Check if this conversation belongs to the user
          const conv = conversations.find(c => c.id === newMsg.conversation_id);
          if (conv || activeConv?.id === newMsg.conversation_id) {
            if (!open || activeConv?.id !== newMsg.conversation_id) {
              setUnreadMap(prev => ({
                ...prev,
                [newMsg.conversation_id]: (prev[newMsg.conversation_id] || 0) + 1,
              }));
              setTotalUnread(prev => prev + 1);
            }
          }
          // Reload conversations to update last_message
          loadConversations();
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, activeConv?.id, open, conversations]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Clear unread when opening a conversation
  const openConversation = async (conv: Conversation) => {
    setActiveConv(conv);
    setScreen('chat');
    await loadMessages(conv.id);
    // Clear unread for this conversation
    const convUnread = unreadMap[conv.id] || 0;
    if (convUnread > 0) {
      setUnreadMap(prev => ({ ...prev, [conv.id]: 0 }));
      setTotalUnread(prev => Math.max(0, prev - convUnread));
    }
  };

  // Get the "other person" name for display
  const getConversationName = (conv: Conversation) => {
    if (conv.conversation_type === 'support') return '🛟 Suporte (Admin)';
    if (conv.user_id === user?.id) return conv.recipient_name || 'Usuário';
    return conv.user_name || 'Usuário';
  };

  // Create or find existing conversation with a user
  const startChatWithUser = async (targetUser: UserProfile) => {
    if (!user?.id) return;

    // Check if conversation already exists between these two users
    const existing = conversations.find(c =>
      c.conversation_type === 'direct' && (
        (c.user_id === user.id && c.recipient_id === targetUser.user_id) ||
        (c.recipient_id === user.id && c.user_id === targetUser.user_id)
      )
    );

    if (existing) {
      await openConversation(existing);
      return;
    }

    // Create new direct conversation
    const { data, error } = await supabase
      .from('support_conversations')
      .insert({
        user_id: user.id,
        user_name: profile?.nome || 'Usuário',
        user_email: profile?.email || '',
        recipient_id: targetUser.user_id,
        recipient_name: targetUser.nome,
        recipient_email: targetUser.email,
        subject: `Chat: ${profile?.nome} ↔ ${targetUser.nome}`,
        conversation_type: 'direct',
      } as any)
      .select()
      .single();

    if (error) {
      toast.error('Erro ao criar conversa');
      return;
    }

    const newConv = data as any;
    setConversations(prev => [newConv, ...prev]);
    await openConversation(newConv);
  };

  // Start support conversation
  const startSupportChat = async () => {
    if (!user?.id) return;

    // Check existing support conversation
    const existing = conversations.find(c => c.conversation_type === 'support' && c.user_id === user.id && c.status === 'open');
    if (existing) {
      await openConversation(existing);
      return;
    }

    const { data, error } = await supabase
      .from('support_conversations')
      .insert({
        user_id: user.id,
        user_name: profile?.nome || 'Usuário',
        user_email: profile?.email || '',
        subject: 'Suporte',
        conversation_type: 'support',
      } as any)
      .select()
      .single();

    if (error) {
      toast.error('Erro ao criar conversa');
      return;
    }

    const newConv = data as any;
    setConversations(prev => [newConv, ...prev]);
    await openConversation(newConv);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending || !user?.id || !activeConv) return;

    setSending(true);
    try {
      const { error } = await supabase.from('support_messages').insert({
        conversation_id: activeConv.id,
        sender_id: user.id,
        sender_name: profile?.nome || 'Usuário',
        content: text,
      });
      if (error) throw error;

      await supabase.from('support_conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', activeConv.id);
      setInput('');
    } catch {
      toast.error('Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id || !activeConv) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Arquivo muito grande (máx 10MB)');
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${activeConv.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('support-attachments')
        .upload(path, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('support-attachments')
        .getPublicUrl(path);

      const { error } = await supabase.from('support_messages').insert({
        conversation_id: activeConv.id,
        sender_id: user.id,
        sender_name: profile?.nome || 'Usuário',
        content: null,
        attachment_path: urlData.publicUrl,
        attachment_name: file.name,
      });
      if (error) throw error;

      await supabase.from('support_conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', activeConv.id);
    } catch {
      toast.error('Erro ao enviar arquivo');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isImage = (name: string | null) => name && /\.(jpg|jpeg|png|gif|webp)$/i.test(name);

  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return users;
    const s = userSearch.toLowerCase();
    return users.filter(u => u.nome.toLowerCase().includes(s) || u.email.toLowerCase().includes(s));
  }, [users, userSearch]);

  // ── Floating button ──
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg hover:scale-105 transition-transform"
        title="Chat"
      >
        <MessageCircle className="w-7 h-7" />
        {totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold">
            {totalUnread}
          </span>
        )}
      </button>
    );
  }

  // ── Chat Window ──
  return (
    <div className="fixed bottom-24 right-6 z-50 w-[400px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-8rem)] flex flex-col bg-background border border-border rounded-xl shadow-2xl overflow-hidden">
      {/* ─── SCREEN: Conversation List ─── */}
      {screen === 'list' && (
        <>
          <div className="flex items-center gap-2 px-4 py-3 bg-primary text-primary-foreground">
...
                      isMe ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
...
            <Button size="icon" onClick={handleSend} disabled={!input.trim() || sending} className="shrink-0 bg-primary hover:bg-primary/90">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
