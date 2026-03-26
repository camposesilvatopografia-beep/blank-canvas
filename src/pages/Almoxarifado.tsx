import { Warehouse, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import AlmDashboard from '@/components/almoxarifado/AlmDashboard';
import AlmMateriais from '@/components/almoxarifado/AlmMateriais';
import AlmEntradas from '@/components/almoxarifado/AlmEntradas';
import AlmSaidas from '@/components/almoxarifado/AlmSaidas';
import AlmMovimentacoes from '@/components/almoxarifado/AlmMovimentacoes';
import AlmInventario from '@/components/almoxarifado/AlmInventario';
import AlmRelatorios from '@/components/almoxarifado/AlmRelatorios';
import AlmLowStockNotifier from '@/components/almoxarifado/AlmLowStockNotifier';
import AlmCadastros from '@/components/almoxarifado/AlmCadastros';

export default function Almoxarifado() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      <AlmLowStockNotifier />
      <div className="flex items-center gap-3">
        <Warehouse className="w-7 h-7 text-yellow-500" />
        <h1 className="text-2xl font-bold text-foreground">Almoxarifado</h1>
        <Badge variant="outline" className="border-yellow-400 text-yellow-600">Em desenvolvimento</Badge>
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <div className="flex flex-wrap items-center gap-1">
          <TabsList className="h-auto gap-1">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="materiais">Materiais</TabsTrigger>
          </TabsList>
          <TabsList className="h-auto gap-1 ml-2">
            <TabsTrigger value="entradas" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white bg-emerald-100 text-emerald-800 font-semibold gap-1"><ArrowDownToLine className="w-4 h-4" /> Entradas</TabsTrigger>
            <TabsTrigger value="saidas" className="data-[state=active]:bg-red-600 data-[state=active]:text-white bg-red-100 text-red-800 font-semibold gap-1"><ArrowUpFromLine className="w-4 h-4" /> Saídas</TabsTrigger>
          </TabsList>
          <TabsList className="h-auto gap-1 ml-2">
            <TabsTrigger value="movimentacoes">Movimentações</TabsTrigger>
            <TabsTrigger value="inventario">Inventário</TabsTrigger>
            <TabsTrigger value="cadastros">Cadastros</TabsTrigger>
            <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="dashboard"><AlmDashboard /></TabsContent>
        <TabsContent value="materiais"><AlmMateriais /></TabsContent>
        <TabsContent value="entradas"><AlmEntradas /></TabsContent>
        <TabsContent value="saidas"><AlmSaidas /></TabsContent>
        <TabsContent value="movimentacoes"><AlmMovimentacoes /></TabsContent>
        <TabsContent value="inventario"><AlmInventario /></TabsContent>
        <TabsContent value="cadastros"><AlmCadastros /></TabsContent>
        <TabsContent value="relatorios"><AlmRelatorios /></TabsContent>
      </Tabs>
    </div>
  );
}
