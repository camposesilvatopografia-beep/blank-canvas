import { useNavigate } from 'react-router-dom';
import { useNotifications } from '@/hooks/useNotifications';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, ClipboardCheck, Package, Clock, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

export const NotificationPanel = () => {
  const { rdosPendentes, lowStockItems, totalCount, loading } = useNotifications();
  const navigate = useNavigate();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {totalCount > 0 && (
            <span className={cn(
              "absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center font-semibold",
              totalCount > 0 && "animate-pulse"
            )}>
              {totalCount > 99 ? '99+' : totalCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0" align="end" sideOffset={8}>
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h3 className="font-semibold text-sm">Central de Alertas</h3>
          </div>
          {totalCount > 0 && (
            <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-medium">
              {totalCount} pendente{totalCount > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <Tabs defaultValue="rdos" className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent h-auto p-0">
            <TabsTrigger
              value="rdos"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs px-4 py-2.5"
            >
              <ClipboardCheck className="w-3.5 h-3.5 mr-1.5" />
              RDOs ({rdosPendentes.length})
            </TabsTrigger>
            <TabsTrigger
              value="estoque"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs px-4 py-2.5"
            >
              <Package className="w-3.5 h-3.5 mr-1.5" />
              Estoque ({lowStockItems.length})
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="max-h-[350px]">
            <TabsContent value="rdos" className="m-0 p-2 space-y-1">
              {rdosPendentes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <ClipboardCheck className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  Nenhum RDO pendente
                </div>
              ) : (
                rdosPendentes.map(rdo => (
                  <button
                    key={rdo.id}
                    onClick={() => navigate('/engenharia/rdo')}
                    className="w-full flex items-start gap-3 p-2.5 rounded-lg hover:bg-accent transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Clock className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {rdo.numero_rdo ? `RDO #${rdo.numero_rdo}` : 'RDO'} — {rdo.obra_nome}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Aguardando aprovação • {format(new Date(rdo.data + 'T12:00:00'), 'dd/MM/yyyy')}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </TabsContent>

            <TabsContent value="estoque" className="m-0 p-2 space-y-1">
              {lowStockItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  Estoque dentro dos limites
                </div>
              ) : (
                lowStockItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => navigate('/almoxarifado')}
                    className="w-full flex items-start gap-3 p-2.5 rounded-lg hover:bg-accent transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Package className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        Saldo: <span className="text-destructive font-medium">{item.estoque_atual}</span> / {item.estoque_minimo} {item.unidade}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
};
