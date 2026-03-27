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
          <div className="flex items-center gap-2 px-4 py-3 bg-blue-600 text-white">
            <MessageCircle className="w-5 h-5" />
            <span className="flex-1 font-semibold text-sm">INTEGRE AO SISTEMA UM AGENTE DE IA</span>
            <button onClick={() => setOpen(false)} className="opacity-70 hover:opacity-100">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-2 p-3 border-b">
            <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={startSupportChat}>
              <Headphones className="w-3.5 h-3.5 mr-1.5" />
              Suporte
            </Button>
            <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => { loadUsers(); setScreen('user-select'); }}>
              <Users className="w-3.5 h-3.5 mr-1.5" />
              Nova Conversa
            </Button>
          </div>

          {/* Conversations list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center gap-2 pt-12 text-center text-muted-foreground px-4">
                <MessageCircle className="w-10 h-10 opacity-30" />
                <p className="text-sm font-medium">Nenhuma conversa</p>
                <p className="text-xs">Inicie uma conversa com o Suporte ou outro usuário.</p>
              </div>
            ) : (
              conversations.map(conv => {
                const name = getConversationName(conv);
                const unread = unreadMap[conv.id] || 0;
                return (
                  <button
                    key={conv.id}
                    onClick={() => openConversation(conv)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 border-b border-border/50 text-left transition-colors"
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${conv.conversation_type === 'support' ? 'bg-green-600' : 'bg-blue-500'}`}>
                      {conv.conversation_type === 'support' ? '🛟' : name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium truncate">{name}</p>
                        <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                          {format(new Date(conv.last_message_at), 'dd/MM HH:mm')}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{conv.subject}</p>
                    </div>
                    {unread > 0 && (
                      <Badge variant="destructive" className="h-5 min-w-[20px] text-[10px] px-1.5">
                        {unread}
                      </Badge>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </>
      )}

      {/* ─── SCREEN: User Select ─── */}
      {screen === 'user-select' && (
        <>
          <div className="flex items-center gap-2 px-4 py-3 bg-blue-600 text-white">
            <button onClick={() => setScreen('list')} className="opacity-70 hover:opacity-100">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="flex-1 font-semibold text-sm">Nova Conversa</span>
            <button onClick={() => setOpen(false)} className="opacity-70 hover:opacity-100">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar usuário..."
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredUsers.map(u => (
              <button
                key={u.user_id}
                onClick={() => startChatWithUser(u)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 border-b border-border/50 text-left transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                  {u.nome.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{u.nome}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email} • {u.tipo}</p>
                </div>
              </button>
            ))}
            {filteredUsers.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">Nenhum usuário encontrado</p>
            )}
          </div>
        </>
      )}

      {/* ─── SCREEN: Chat ─── */}
      {screen === 'chat' && activeConv && (
        <>
          <div className="flex items-center gap-2 px-4 py-3 bg-blue-600 text-white">
            <button onClick={() => { setScreen('list'); setActiveConv(null); setMessages([]); loadConversations(); }} className="opacity-70 hover:opacity-100">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-sm truncate block">{getConversationName(activeConv)}</span>
            </div>
            <button onClick={() => setOpen(false)} className="opacity-70 hover:opacity-100">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center gap-2 pt-8 text-center text-muted-foreground">
                <MessageCircle className="w-10 h-10 opacity-30" />
                <p className="text-sm font-medium">Descreva o agente de IA para criar!</p>
              </div>
            ) : (
              messages.map(msg => {
                const isMe = msg.sender_id === user?.id;
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      isMe ? 'bg-blue-600 text-white' : 'bg-muted text-foreground'
                    }`}>
                      {!isMe && <p className="text-xs font-semibold mb-1 opacity-70">{msg.sender_name}</p>}
                      {msg.content && <p className="whitespace-pre-wrap">{msg.content}</p>}
                      {msg.attachment_path && (
                        isImage(msg.attachment_name) ? (
                          <a href={msg.attachment_path} target="_blank" rel="noopener noreferrer">
                            <img src={msg.attachment_path} alt={msg.attachment_name || 'anexo'} className="max-w-full rounded mt-1 max-h-48 object-cover" />
                          </a>
                        ) : (
                          <a href={msg.attachment_path} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-1 mt-1 text-xs underline ${isMe ? 'text-blue-100' : 'text-blue-600'}`}>
                            <Paperclip className="w-3 h-3" />
                            {msg.attachment_name || 'Arquivo'}
                          </a>
                        )
                      )}
                      <p className={`text-[10px] mt-1 ${isMe ? 'text-blue-200' : 'text-muted-foreground'}`}>
                        {format(new Date(msg.created_at), 'HH:mm', { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Input */}
          <div className="border-t p-3 flex gap-2 items-end">
            <input ref={fileRef} type="file" className="hidden" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={handleFileUpload} />
            <Button variant="ghost" size="icon" className="shrink-0" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
            </Button>
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Descreva o agente de IA para o sistema..."
              className="resize-none min-h-[40px] max-h-[100px] text-sm"
              rows={1}
              disabled={sending}
            />
            <Button size="icon" onClick={handleSend} disabled={!input.trim() || sending} className="shrink-0 bg-blue-600 hover:bg-blue-700">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
