
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Droplets, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FrotaAbastecimentosTab } from "@/components/frota/FrotaAbastecimentosTab";
import { AbastecimentoModal } from "@/components/manutencao/AbastecimentoModal";
import { useGoogleSheets } from "@/hooks/useGoogleSheets";

const Abastecimentos = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Droplets className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Abastecimentos</h1>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleRefresh} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Abastecimento
          </Button>
        </div>
      </div>

      <FrotaAbastecimentosTab key={refreshTrigger} />

      <AbastecimentoModal 
        open={modalOpen} 
        onOpenChange={setModalOpen} 
        onSuccess={handleRefresh}
      />
    </div>
  );
};

export default Abastecimentos;
