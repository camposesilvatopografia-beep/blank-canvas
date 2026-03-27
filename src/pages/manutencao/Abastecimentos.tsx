import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Droplets } from "lucide-react";

const Abastecimentos = () => {
  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Droplets className="w-6 h-6 text-primary" />
          <CardTitle>Abastecimentos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Módulo de controle de abastecimentos em desenvolvimento.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Abastecimentos;
