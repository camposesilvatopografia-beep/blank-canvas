import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { MessageCircle, X, Send, Paperclip, Loader2, ArrowLeft, Users, Headphones, Search, User } from 'lucide-react';
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

type Screen = 'list' | 'chat' | 'user-select';

export default function SupportChatWidget() {
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

  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});

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
        if (activeConv && newMsg.conversation_id === activeConv.id) {
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
        
        if (newMsg.sender_id !== user.id) {
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
          loadConversations();
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, activeConv?.id, open, conversations, loadConversations]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const openConversation = async (conv: Conversation) => {
    setActiveConv(conv);
    setScreen('chat');
    await loadMessages(conv.id);
    const convUnread = unreadMap[conv.id] || 0;
    if (convUnread > 0) {
      setUnreadMap(prev => ({ ...prev, [conv.id]: 0 }));
      setTotalUnread(prev => Math.max(0, prev - convUnread));
    }
  };

  const getConversationName = (conv: Conversation) => {
    if (conv.conversation_type === 'support') return '🛟 Suporte (Admin)';
    if (conv.user_id === user?.id) return conv.recipient_name || 'Usuário';
    return conv.user_name || 'Usuário';
  };

  const startChatWithUser = async (targetUser: UserProfile) => {
    if (!user?.id) return;

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

  const startSupportChat = async () => {
    if (!user?.id) return;

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

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-transform"
        title="Chat"
      >
        <MessageCircle className="w-7 h-7" />
        {totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-bold">
            {totalUnread}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-24 right-6 z-50 w-[400px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-8rem)] flex flex-col bg-background border border-border rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-5">
      {screen === 'list' && (
        <>
          <div className="flex items-center gap-2 px-4 py-3 bg-primary text-primary-foreground">
            <MessageCircle className="w-5 h-5" />
            <span className="font-semibold text-sm flex-1">Mensagens</span>
            <button onClick={() => setOpen(false)} className="opacity-70 hover:opacity-100">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-3">
              <Button 
                variant="outline" 
                className="w-full justify-start gap-2 h-12" 
                onClick={async () => { await loadUsers(); setScreen('user-select'); }}
              >
                <Users className="w-5 h-5 text-primary" />
                <span>Conversar com usuário</span>
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start gap-2 h-12 border-primary/20 bg-primary/5" 
                onClick={startSupportChat}
              >
                <Headphones className="w-5 h-5 text-primary" />
                <span>Suporte (jeanallbuquerque@gmail.com)</span>
              </Button>
            </div>
            
            <div className="border-t">
              <div className="px-4 py-2 bg-muted/30">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Conversas recentes</p>
              </div>
              {loading ? (
                <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : conversations.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground italic text-sm">Nenhuma conversa ativa</div>
              ) : (
                conversations.map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => openConversation(conv)}
                    className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 border-b last:border-0 transition-colors"
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${conv.conversation_type === 'support' ? 'bg-amber-100 text-amber-600' : 'bg-primary/10 text-primary'}`}>
                      {conv.conversation_type === 'support' ? <Headphones className="w-5 h-5" /> : <User className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm truncate">{getConversationName(conv)}</p>
                        <p className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {format(new Date(conv.last_message_at), 'HH:mm', { locale: ptBR })}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{conv.subject}</p>
                    </div>
                    {unreadMap[conv.id] > 0 && (
                      <Badge className="bg-destructive text-destructive-foreground ml-2 h-5 min-w-5 flex items-center justify-center rounded-full p-0">
                        {unreadMap[conv.id]}
                      </Badge>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {screen === 'user-select' && (
        <>
          <div className="flex items-center gap-2 px-4 py-3 bg-primary text-primary-foreground">
            <button onClick={() => setScreen('list')} className="opacity-70 hover:opacity-100 mr-2">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="font-semibold text-sm flex-1">Selecionar Usuário</span>
            <button onClick={() => setOpen(false)} className="opacity-70 hover:opacity-100">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar usuário..." 
                className="pl-9"
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredUsers.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground text-sm">Nenhum usuário encontrado</div>
            ) : (
              filteredUsers.map(u => (
                <button
                  key={u.user_id}
                  onClick={() => startChatWithUser(u)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 border-b last:border-0 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-medium text-sm truncate">{u.nome}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.tipo}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </>
      )}

      {screen === 'chat' && activeConv && (
        <>
          <div className="flex items-center gap-2 px-4 py-3 bg-primary text-primary-foreground">
            <button onClick={() => setScreen('list')} className="opacity-70 hover:opacity-100 mr-2">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{getConversationName(activeConv)}</p>
              {activeConv.status === 'closed' && <Badge variant="secondary" className="bg-white/20 text-white text-[9px] h-4">Encerrada</Badge>}
            </div>
            <button onClick={() => setOpen(false)} className="opacity-70 hover:opacity-100">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, i) => {
              const isMe = msg.sender_id === user?.id;
              return (
                <div key={msg.id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                    isMe ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                  }`}>
                    {!isMe && <p className="text-[10px] font-bold mb-1 opacity-70">{msg.sender_name}</p>}
                    {msg.content && <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>}
                    {msg.attachment_path && (
                      <div className="mt-2">
                        {isImage(msg.attachment_name) ? (
                          <a href={msg.attachment_path} target="_blank" rel="noopener noreferrer">
                            <img src={msg.attachment_path} alt={msg.attachment_name || ''} className="max-w-full rounded border border-white/20 max-h-60 object-contain bg-black/5" />
                          </a>
                        ) : (
                          <a 
                            href={msg.attachment_path} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className={`flex items-center gap-2 p-2 rounded border ${isMe ? 'bg-white/10 border-white/20 hover:bg-white/20' : 'bg-background border-border hover:bg-muted'} transition-colors`}
                          >
                            <Paperclip className="w-4 h-4 shrink-0" />
                            <span className="text-xs truncate font-medium">{msg.attachment_name || 'Arquivo'}</span>
                          </a>
                        )}
                      </div>
                    )}
                    <p className={`text-[9px] mt-1 text-right opacity-70`}>
                      {format(new Date(msg.created_at), 'HH:mm', { locale: ptBR })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 border-t bg-background">
            <div className="flex gap-2 items-end">
              <input ref={fileRef} type="file" className="hidden" onChange={handleFileUpload} />
              <Button 
                variant="ghost" 
                size="icon" 
                className="shrink-0 text-muted-foreground hover:text-primary" 
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
              </Button>
              <Textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escreva sua mensagem..."
                className="resize-none min-h-[40px] max-h-[120px] text-sm py-2"
                rows={1}
                disabled={sending}
              />
              <Button 
                size="icon" 
                onClick={handleSend} 
                disabled={!input.trim() || sending} 
                className="shrink-0 bg-primary hover:bg-primary/90 h-10 w-10 shadow-md"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}