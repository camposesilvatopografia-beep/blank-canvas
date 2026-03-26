import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FrotaHorimetrosTab } from '@/components/frota/FrotaHorimetrosTab';
import { FrotaMonitoramentoTab } from '@/components/frota/FrotaMonitoramentoTab';
import { Clock, Eye } from 'lucide-react';

export default function HistoricoVeiculos() {
  const [activeTab, setActiveTab] = useState('horimetros');

  return (
    <div className="space-y-4 p-2 md:p-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="horimetros" className="gap-1.5">
            <Clock className="w-4 h-4" />
            Horímetros
          </TabsTrigger>
          <TabsTrigger value="monitoramento" className="gap-1.5">
            <Eye className="w-4 h-4" />
            Monitoramento
          </TabsTrigger>
        </TabsList>
        <TabsContent value="horimetros" className="mt-4">
          <FrotaHorimetrosTab />
        </TabsContent>
        <TabsContent value="monitoramento" className="mt-4">
          <FrotaMonitoramentoTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
