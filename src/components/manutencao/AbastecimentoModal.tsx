
import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, Check, ChevronsUpDown } from "lucide-react";
import { useGoogleSheets } from "@/hooks/useGoogleSheets";
import { useVehicles, Vehicle } from "@/hooks/useVehicles";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AbastecimentoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AbastecimentoModal({ open, onOpenChange, onSuccess }: AbastecimentoModalProps) {
  const { vehicles, loading: loadingVehicles } = useVehicles();
  const { appendSheet, readSheet, loading: saving } = useGoogleSheets();
  const [loadingLast, setLoadingLast] = useState(false);
  const [comboboxOpen, setComboboxOpen] = useState(false);

  const [formData, setFormData] = useState({
    data: format(new Date(), "dd/MM/yyyy"),
    hora: format(new Date(), "HH:mm"),
    tipo: "Saida",
    local_entrada: "",
    local: "",
    veiculo: "",
    horimetro_anterior: "",
    horimetro_atual: "",
    km_anterior: "",
    km_atual: "",
    quantidade: "",
    tipo_combustivel: "Diesel S10",
    arla: "Não",
    quantidade_arla: "",
    fornecedor: "",
    nota_fiscal: "",
    valor_unitario: "",
  });

  const [selectedVehicleData, setSelectedVehicleData] = useState<Vehicle | null>(null);

  const fetchLastEntry = useCallback(async (veiculo: string) => {
    setLoadingLast(true);
    try {
      // Read last 100 rows to find the last entry for this vehicle
      // This is a bit inefficient but necessary without a proper DB query
      const data = await readSheet("Abastecimentos");
      if (data && data.length > 1) {
        const hdrs = (data[0] as string[]).map(h => String(h || '').trim().toLowerCase());
        const veiculoIdx = hdrs.findIndex(h => h.includes("veiculo"));
        const horAtualIdx = hdrs.findIndex(h => h === "horimetro atual");
        const kmAtualIdx = hdrs.findIndex(h => h === "km atual");

        // Search backwards
        for (let i = data.length - 1; i >= 1; i--) {
          if (String(data[i][veiculoIdx]).trim().toUpperCase() === veiculo.toUpperCase()) {
            const lastHor = String(data[i][horAtualIdx] || "").trim();
            const lastKm = String(data[i][kmAtualIdx] || "").trim();
            
            setFormData(prev => ({
              ...prev,
              horimetro_anterior: lastHor,
              km_anterior: lastKm
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
        veiculo: vehicle.prefixo 
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
      // Build the row according to sheet headers
      // [id, DATA, HORA, TIPO, LOCAL DE ENTRADA, LOCAL, CATEGORIA, VEICULO, POTENCIA, DESCRICAO, MOTORISTA, EMPRESA, OBRA, HORIMETRO ANTERIOR, HORIMETRO ATUAL, INTERVALO HORAS, KM ANTERIOR, KM ATUAL, INTERVALO KM, QUANTIDADE, TIPO DE COMBUSTIVEL, ARLA, QUANTIDADE DE ARLA, FORNECEDOR, NOTA FISCAL,  VALOR UNITÁRIO ]
      
      const id = Math.random().toString(36).substring(2, 10);
      
      // Calculate intervals
      const horAnt = parseFloat(formData.horimetro_anterior.replace(',', '.')) || 0;
      const horAtu = parseFloat(formData.horimetro_atual.replace(',', '.')) || 0;
      const intH = horAtu > horAnt ? (horAtu - horAnt).toFixed(2).replace('.', ',') : "";

      const kmAnt = parseFloat(formData.km_anterior.replace(',', '.')) || 0;
      const kmAtu = parseFloat(formData.km_atual.replace(',', '.')) || 0;
      const intKm = kmAtu > kmAnt ? (kmAtu - kmAnt).toFixed(2).replace('.', ',') : "";

      const row = [
        id,
        formData.data,
        formData.hora,
        formData.tipo,
        formData.local_entrada,
        formData.local,
        selectedVehicleData?.tipo || "",
        formData.veiculo,
        "", // Potencia
        selectedVehicleData?.descricao || "",
        selectedVehicleData?.motorista || selectedVehicleData?.operador || "",
        selectedVehicleData?.empresa || "",
        "", // Obra
        formData.horimetro_anterior,
        formData.horimetro_atual,
        intH,
        formData.km_anterior,
        formData.km_atual,
        intKm,
        formData.quantidade,
        formData.tipo_combustivel,
        formData.arla,
        formData.quantidade_arla,
        formData.fornecedor,
        formData.nota_fiscal,
        formData.valor_unitario
      ];

      const success = await appendSheet("Abastecimentos", [row]);
      if (success) {
        toast.success("Abastecimento registrado com sucesso!");
        onSuccess?.();
        onOpenChange(false);
      }
    } catch (err) {
      console.error("Error saving abastecimento:", err);
      toast.error("Erro ao salvar abastecimento");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Abastecimento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data</Label>
              <Input 
                value={formData.data} 
                onChange={e => setFormData(p => ({ ...p, data: e.target.value }))}
                placeholder="dd/mm/aaaa"
              />
            </div>
            <div className="space-y-2">
              <Label>Hora</Label>
              <Input 
                value={formData.hora} 
                onChange={e => setFormData(p => ({ ...p, hora: e.target.value }))}
                placeholder="hh:mm"
              />
            </div>
          </div>

          <div className="space-y-2 flex flex-col">
            <Label>Veículo / Equipamento</Label>
            <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={comboboxOpen}
                  className="w-full justify-between"
                  disabled={loadingVehicles}
                >
                  {formData.veiculo
                    ? vehicles.find((v) => v.prefixo === formData.veiculo)?.prefixo + " - " + vehicles.find((v) => v.prefixo === formData.veiculo)?.descricao
                    : "Selecione o veículo..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Buscar prefixo ou descrição..." />
                  <CommandList>
                    <CommandEmpty>Nenhum veículo encontrado.</CommandEmpty>
                    <CommandGroup>
                      {vehicles.map((v) => (
                        <CommandItem
                          key={v.prefixo}
                          value={v.prefixo + " " + v.descricao}
                          onSelect={() => handleVehicleSelect(v.prefixo)}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              formData.veiculo === v.prefixo ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {v.prefixo} - {v.descricao} ({v.empresa})
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg">
            <div className="space-y-2">
              <Label className="text-primary font-bold">Horímetro Anterior</Label>
              <Input 
                value={formData.horimetro_anterior} 
                onChange={e => setFormData(p => ({ ...p, horimetro_anterior: e.target.value }))}
                placeholder={loadingLast ? "Buscando..." : "0,00"}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-primary font-bold">Horímetro Atual</Label>
              <Input 
                value={formData.horimetro_atual} 
                onChange={e => setFormData(p => ({ ...p, horimetro_atual: e.target.value }))}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-blue-500 font-bold">KM Anterior</Label>
              <Input 
                value={formData.km_anterior} 
                onChange={e => setFormData(p => ({ ...p, km_anterior: e.target.value }))}
                placeholder={loadingLast ? "Buscando..." : "0,00"}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-blue-500 font-bold">KM Atual</Label>
              <Input 
                value={formData.km_atual} 
                onChange={e => setFormData(p => ({ ...p, km_atual: e.target.value }))}
                placeholder="0,00"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Quantidade (L)</Label>
              <Input 
                value={formData.quantidade} 
                onChange={e => setFormData(p => ({ ...p, quantidade: e.target.value }))}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label>Combustível</Label>
              <Select value={formData.tipo_combustivel} onValueChange={v => setFormData(p => ({ ...p, tipo_combustivel: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Diesel S10">Diesel S10</SelectItem>
                  <SelectItem value="Diesel S500">Diesel S500</SelectItem>
                  <SelectItem value="Gasolina">Gasolina</SelectItem>
                  <SelectItem value="Etanol">Etanol</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Arla?</Label>
              <Select value={formData.arla} onValueChange={v => setFormData(p => ({ ...p, arla: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sim">Sim</SelectItem>
                  <SelectItem value="Não">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fornecedor</Label>
              <Input 
                value={formData.fornecedor} 
                onChange={e => setFormData(p => ({ ...p, fornecedor: e.target.value }))}
                placeholder="Ex: Posto Ipiranga"
              />
            </div>
            <div className="space-y-2">
              <Label>Nota Fiscal</Label>
              <Input 
                value={formData.nota_fiscal} 
                onChange={e => setFormData(p => ({ ...p, nota_fiscal: e.target.value }))}
                placeholder="Número da NF"
              />
            </div>
          </div>

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
