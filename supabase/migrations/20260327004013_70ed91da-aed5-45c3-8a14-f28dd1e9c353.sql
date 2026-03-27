-- Create tables for backups of Google Sheets data

-- 1. Descarga (Lançamento)
CREATE TABLE IF NOT EXISTS public.apontamentos_descarga (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    external_id TEXT, -- Original ID from sheet
    data DATE NOT NULL,
    hora TIME,
    prefixo_caminhao TEXT,
    descricao_caminhao TEXT,
    empresa_caminhao TEXT,
    motorista TEXT,
    volume NUMERIC,
    viagens NUMERIC DEFAULT 1,
    volume_total NUMERIC,
    local TEXT,
    estaca TEXT,
    material TEXT,
    usuario TEXT,
    encarregado TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Pedreira
CREATE TABLE IF NOT EXISTS public.movimentacoes_pedreira (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    external_id TEXT,
    data DATE NOT NULL,
    hora TIME,
    prefixo_caminhao TEXT,
    empresa_caminhao TEXT,
    motorista TEXT,
    fornecedor TEXT,
    material TEXT,
    nota_fiscal TEXT,
    viagens NUMERIC DEFAULT 1,
    volume NUMERIC,
    volume_total NUMERIC,
    local TEXT,
    estaca TEXT,
    usuario TEXT,
    encarregado TEXT,
    foto_path TEXT,
    nf_foto_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Pipas
CREATE TABLE IF NOT EXISTS public.movimentacoes_pipas (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    external_id TEXT,
    data DATE NOT NULL,
    hora TIME,
    prefixo_pipa TEXT,
    motorista TEXT,
    empresa TEXT,
    local TEXT,
    atividade TEXT,
    volume NUMERIC,
    viagens NUMERIC DEFAULT 1,
    volume_total NUMERIC,
    usuario TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Cal
CREATE TABLE IF NOT EXISTS public.movimentacoes_cal (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    external_id TEXT,
    data DATE NOT NULL,
    hora TIME,
    prefixo_caminhao TEXT,
    motorista TEXT,
    fornecedor TEXT,
    nota_fiscal TEXT,
    quantidade NUMERIC,
    local TEXT,
    estaca TEXT,
    usuario TEXT,
    foto_path TEXT,
    nf_foto_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 5. Usina Solos
CREATE TABLE IF NOT EXISTS public.movimentacoes_usina_solos (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    external_id TEXT,
    data DATE NOT NULL,
    hora TIME,
    usina TEXT,
    material TEXT,
    quantidade NUMERIC,
    umidade NUMERIC,
    local TEXT,
    usuario TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for all
ALTER TABLE public.apontamentos_descarga ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacoes_pedreira ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacoes_pipas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacoes_cal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacoes_usina_solos ENABLE ROW LEVEL SECURITY;

-- Create policies (Allow all for now, or match existing Auth policies if known)
-- For simplicity and following the project's likely setup:
CREATE POLICY "Allow all for authenticated users on apontamentos_descarga" ON public.apontamentos_descarga FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated users on movimentacoes_pedreira" ON public.movimentacoes_pedreira FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated users on movimentacoes_pipas" ON public.movimentacoes_pipas FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated users on movimentacoes_cal" ON public.movimentacoes_cal FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated users on movimentacoes_usina_solos" ON public.movimentacoes_usina_solos FOR ALL TO authenticated USING (true);

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_apontamentos_descarga_updated_at BEFORE UPDATE ON public.apontamentos_descarga FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_movimentacoes_pedreira_updated_at BEFORE UPDATE ON public.movimentacoes_pedreira FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_movimentacoes_pipas_updated_at BEFORE UPDATE ON public.movimentacoes_pipas FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_movimentacoes_cal_updated_at BEFORE UPDATE ON public.movimentacoes_cal FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_movimentacoes_usina_solos_updated_at BEFORE UPDATE ON public.movimentacoes_usina_solos FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
