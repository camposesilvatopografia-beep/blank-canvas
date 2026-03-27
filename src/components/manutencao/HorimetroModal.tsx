
import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Check, ChevronsUpDown } from "lucide-react";
import { useGoogleSheets } from "@/hooks/useGoogleSheets";
import { useVehicles, Vehicle } from "@/hooks/useVehicles";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface HorimetroModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function HorimetroModal({ open, onOpenChange, onSuccess }: HorimetroModalProps) {
  const { vehicles, loading: loadingVehicles } = useVehicles();
  const { appendSheet, readSheet, loading: saving } = useGoogleSheets();
  const [loadingLast, setLoadingLast] = useState(false);
  const [comboboxOpen, setComboboxOpen] = useState(false);

  const [formData, setFormData] = useState({
    data: format(new Date(), "dd/MM/yyyy"),
    veiculo: "",
    operador: "",
    horimetro_anterior: "",
    horimetro_atual: "",
    km_anterior: "",
    km_atual: "",
  });

  const [selectedVehicleData, setSelectedVehicleData] = useState<Vehicle | null>(null);

  const fetchLastEntry = useCallback(async (veiculo: string) => {
    setLoadingLast(true);
    try {
      const data = await readSheet("Horimetros");
      if (data && data.length > 1) {
        const hdrs = (data[0] as string[]).map(h => String(h || '').trim().toLowerCase());
        const veiculoIdx = hdrs.findIndex(h => h.includes("veiculo"));
        const horAtualIdx = hdrs.findIndex(h => h === "horimetro atual");
        const kmAtualIdx = hdrs.findIndex(h => h === "km atual");

        for (let i = data.length - 1; i >= 1; i--) {
          if (String(data[i][veiculoIdx]).trim().toUpperCase() === veiculo.toUpperCase()) {
            setFormData(prev => ({
              ...prev,
              horimetro_anterior: String(data[i][horAtualIdx] || "").trim(),
              km_anterior: String(data[i][kmAtualIdx] || "").trim()
            }));
            break;
          }
        }
      }
    } catch (err) {
      console.error("Error fetching last entry:", err);
    } finally {
      setLoadingLast(false);
    }
  }, [readSheet]);

  const handleVehicleSelect = (prefixo: string) => {
    const vehicle = vehicles.find(v => v.prefixo === prefixo);
    if (vehicle) {
      setSelectedVehicleData(vehicle);
      setFormData(prev => ({ 
        ...prev, 
        veiculo: vehicle.prefixo,
        operador: vehicle.motorista || vehicle.operador || ""
      }));
      fetchLastEntry(vehicle.prefixo);
    }
    setComboboxOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.veiculo) {
      toast.error("Selecione um veículo");
      return;
    }

    try {
      // Headers: [id, Data, Veiculo, Categoria, Descricao, Empresa, Operador, Horimetro Anterior, Horimetro Atual, Intervalo H, Km Anterior, Km Atual, Total Km]
      const id = Math.random().toString(36).substring(2, 10);
      
      const horAnt = parseFloat(formData.horimetro_anterior.replace(',', '.')) || 0;
      const horAtu = parseFloat(formData.horimetro_atual.replace(',', '.')) || 0;
      const intH = horAtu > horAnt ? (horAtu - horAnt).toFixed(2).replace('.', ',') : "";

      const kmAnt = parseFloat(formData.km_anterior.replace(',', '.')) || 0;
      const kmAtu = parseFloat(formData.km_atual.replace(',', '.')) || 0;
      const intKm = kmAtu > kmAnt ? (kmAtu - kmAnt).toFixed(2).replace('.', ',') : "";

      const row = [
        id,
        formData.data,
        formData.veiculo,
        selectedVehicleData?.tipo || "",
        selectedVehicleData?.descricao || "",
        selectedVehicleData?.empresa || "",
        formData.operador,
        formData.horimetro_anterior,
        formData.horimetro_atual,
        intH,
        formData.km_anterior,
        formData.km_atual,
        intKm
      ];

      const success = await appendSheet("Horimetros", [row]);
      if (success) {
        toast.success("Horímetro registrado com sucesso!");
        onSuccess?.();
        onOpenChange(false);
      }
    } catch (err) {
      console.error("Error saving horímetro:", err);
      toast.error("Erro ao salvar horímetro");
    }
  };

  const isVehicle = selectedVehicleData?.tipo?.toLowerCase() === 'veiculo' || selectedVehicleData?.tipo?.toLowerCase() === 'veículo';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Lançamento de Horímetro / KM</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Data</Label>
            <Input 
              value={formData.data} 
              onChange={e => setFormData(p => ({ ...p, data: e.target.value }))}
              placeholder="dd/mm/aaaa"
            />
          </div>

          <div className="space-y-2 flex flex-col">
            <Label>Veículo / Equipamento</Label>
            <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between"
                  disabled={loadingVehicles}
                >
                  {formData.veiculo
                    ? vehicles.find((v) => v.prefixo === formData.veiculo)?.prefixo + " - " + vehicles.find((v) => v.prefixo === formData.veiculo)?.descricao
                    : "Selecione..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Buscar prefixo ou descrição..." />
                  <CommandList>
                    <CommandEmpty>Nenhum encontrado.</CommandEmpty>
                    <CommandGroup>
                      {vehicles.map((v) => (
                        <CommandItem
                          key={v.prefixo}
                          value={v.prefixo + " " + v.descricao}
                          onSelect={() => handleVehicleSelect(v.prefixo)}
                        >
                          <Check className={cn("mr-2 h-4 w-4", formData.veiculo === v.prefixo ? "opacity-100" : "opacity-0")} />
                          {v.prefixo} - {v.descricao}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Operador / Motorista</Label>
            <Input 
              value={formData.operador} 
              onChange={e => setFormData(p => ({ ...p, operador: e.target.value }))}
            />
          </div>

          {!isVehicle && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Horímetro Anterior</Label>
                <Input 
                  value={formData.horimetro_anterior} 
                  onChange={e => setFormData(p => ({ ...p, horimetro_anterior: e.target.value }))}
                  placeholder={loadingLast ? "Buscando..." : "0,00"}
                />
              </div>
              <div className="space-y-2">
                <Label>Horímetro Atual</Label>
                <Input 
                  value={formData.horimetro_atual} 
                  onChange={e => setFormData(p => ({ ...p, horimetro_atual: e.target.value }))}
                  placeholder="0,00"
                />
              </div>
            </div>
          )}

          {isVehicle && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>KM Anterior</Label>
                <Input 
                  value={formData.km_anterior} 
                  onChange={e => setFormData(p => ({ ...p, km_anterior: e.target.value }))}
                  placeholder={loadingLast ? "Buscando..." : "0,00"}
                />
              </div>
              <div className="space-y-2">
                <Label>KM Atual</Label>
                <Input 
                  value={formData.km_atual} 
                  onChange={e => setFormData(p => ({ ...p, km_atual: e.target.value }))}
                  placeholder="0,00"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !formData.veiculo}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
