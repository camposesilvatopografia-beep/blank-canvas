import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, Send, Paperclip, Loader2, User, Clock, ChevronLeft, Image, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface Conversation {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  recipient_id: string | null;
  recipient_name: string | null;
  recipient_email: string | null;
  conversation_type: string;
  subject: string;
  status: string;
  last_message_at: string;
  created_at: string;
}

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

export default function SupportInbox() {
  const { user, profile } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadConversations = useCallback(async () => {
    const { data } = await supabase
      .from('support_conversations')
      .select('*')
      .order('last_message_at', { ascending: false });
    if (data) setConversations(data as any);
    setLoading(false);
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Realtime for new conversations
  useEffect(() => {
    const channel = supabase
      .channel('admin-support-convs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_conversations' }, () => {
        loadConversations();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadConversations]);

  const loadMessages = async (conv: Conversation) => {
    setSelected(conv);
    const { data } = await supabase
      .from('support_messages')
      .select('*')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true });
    if (data) setMessages(data as any);
  };

  // Realtime for messages in selected conversation
  useEffect(() => {
    if (!selected?.id) return;
    const channel = supabase
      .channel(`admin-msgs-${selected.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'support_messages',
        filter: `conversation_id=eq.${selected.id}`,
      }, (payload) => {
        const newMsg = payload.new as Message;
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selected?.id]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending || !selected || !user?.id) return;
    setSending(true);
    try {
      const { error } = await supabase.from('support_messages').insert({
        conversation_id: selected.id,
        sender_id: user.id,
        sender_name: profile?.nome || 'Administrador',
        content: text,
      });
      if (error) throw error;
      await supabase.from('support_conversations').update({ last_message_at: new Date().toISOString() }).eq('id', selected.id);
      setInput('');
    } catch {
      toast.error('Erro ao enviar');
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selected || !user?.id) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${selected.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('support-attachments').upload(path, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('support-attachments').getPublicUrl(path);
      const { error } = await supabase.from('support_messages').insert({
        conversation_id: selected.id,
        sender_id: user.id,
        sender_name: profile?.nome || 'Administrador',
        content: null,
        attachment_path: urlData.publicUrl,
        attachment_name: file.name,
      });
      if (error) throw error;
      await supabase.from('support_conversations').update({ last_message_at: new Date().toISOString() }).eq('id', selected.id);
    } catch {
      toast.error('Erro ao enviar arquivo');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const toggleStatus = async (conv: Conversation) => {
    const newStatus = conv.status === 'open' ? 'closed' : 'open';
    await supabase.from('support_conversations').update({ status: newStatus }).eq('id', conv.id);
    loadConversations();
    if (selected?.id === conv.id) setSelected({ ...conv, status: newStatus });
  };

  const isImage = (name: string | null) => name && /\.(jpg|jpeg|png|gif|webp)$/i.test(name);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle className="w-6 h-6 text-blue-600" />
        <h1 className="text-xl font-bold">Mensagens</h1>
        <Badge variant="secondary">{conversations.filter(c => c.status === 'open').length} abertas</Badge>
        <Badge variant="outline" className="text-xs">{conversations.filter(c => c.conversation_type === 'direct').length} diretas</Badge>
      </div>

      <div className="flex flex-1 border rounded-lg overflow-hidden bg-background min-h-0">
        {/* Conversations list */}
        <div className={`w-full md:w-80 border-r flex flex-col ${selected ? 'hidden md:flex' : ''}`}>
          <div className="p-3 border-b bg-muted/30">
            <p className="text-sm font-medium text-muted-foreground">Conversas</p>
          </div>
          <ScrollArea className="flex-1">
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : conversations.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">Nenhuma conversa</p>
            ) : (
              conversations.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => loadMessages(conv)}
                  className={`w-full text-left p-3 border-b hover:bg-muted/50 transition-colors ${selected?.id === conv.id ? 'bg-blue-50 dark:bg-blue-950/20' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${conv.conversation_type === 'direct' ? 'bg-purple-100 dark:bg-purple-900' : 'bg-blue-100 dark:bg-blue-900'}`}>
                      <User className={`w-4 h-4 ${conv.conversation_type === 'direct' ? 'text-purple-600' : 'text-blue-600'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-medium truncate">{conv.user_name}</p>
                        {conv.conversation_type === 'direct' && conv.recipient_name && (
                          <span className="text-xs text-muted-foreground">↔ {conv.recipient_name}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{conv.user_email}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge variant={conv.status === 'open' ? 'default' : 'secondary'} className="text-[10px]">
                        {conv.status === 'open' ? 'Aberta' : 'Fechada'}
                      </Badge>
                      <Badge variant="outline" className="text-[9px]">
                        {conv.conversation_type === 'direct' ? '💬 Direta' : '🛟 Suporte'}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {format(new Date(conv.last_message_at), "dd/MM HH:mm", { locale: ptBR })}
                  </p>
                </button>
              ))
            )}
          </ScrollArea>
        </div>

        {/* Chat area */}
        <div className={`flex-1 flex flex-col ${!selected ? 'hidden md:flex' : ''}`}>
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Selecione uma conversa</p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="flex items-center gap-2 p-3 border-b bg-muted/30">
                <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSelected(null)}>
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{selected.user_name}</p>
                  <p className="text-xs text-muted-foreground">{selected.user_email}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleStatus(selected)}
                  className="text-xs"
                >
                  {selected.status === 'open' ? (
                    <><CheckCircle2 className="w-3 h-3 mr-1" /> Fechar</>
                  ) : (
                    <><XCircle className="w-3 h-3 mr-1" /> Reabrir</>
                  )}
                </Button>
              </div>

              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
                {messages.map(msg => {
                  const isMe = msg.sender_id === user?.id;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                        isMe ? 'bg-blue-600 text-white' : 'bg-muted text-foreground'
                      }`}>
                        {!isMe && <p className="text-xs font-semibold mb-1 opacity-70">{msg.sender_name}</p>}
                        {msg.content && <p className="whitespace-pre-wrap">{msg.content}</p>}
                        {msg.attachment_path && (
                          isImage(msg.attachment_name) ? (
                            <a href={msg.attachment_path} target="_blank" rel="noopener noreferrer">
                              <img src={msg.attachment_path} alt={msg.attachment_name || ''} className="max-w-full rounded mt-1 max-h-48 object-cover" />
                            </a>
                          ) : (
                            <a href={msg.attachment_path} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-1 mt-1 text-xs underline ${isMe ? 'text-blue-100' : 'text-blue-600'}`}>
                              <Paperclip className="w-3 h-3" />{msg.attachment_name || 'Arquivo'}
                            </a>
                          )
                        )}
                        <p className={`text-[10px] mt-1 ${isMe ? 'text-blue-200' : 'text-muted-foreground'}`}>
                          {format(new Date(msg.created_at), 'HH:mm', { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  );
                })}
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
                  placeholder="Responder..."
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
      </div>
    </div>
  );
}
