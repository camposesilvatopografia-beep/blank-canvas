import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gauge } from "lucide-react";

const Horimetros = () => {
  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Gauge className="w-6 h-6 text-primary" />
          <CardTitle>Horímetros</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Módulo de controle de horímetros em desenvolvimento.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Horimetros;
