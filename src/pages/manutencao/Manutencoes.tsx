import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wrench } from "lucide-react";

const Manutencoes = () => {
  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Wrench className="w-6 h-6 text-primary" />
          <CardTitle>Manutenções</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Módulo de controle de manutenções em desenvolvimento.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Manutencoes;
