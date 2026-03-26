
-- Insert detailed layer services for Retigráfico

-- Solo-Cal layers (3 camadas de 20cm)
INSERT INTO servicos_retigrafico (nome, unidade) VALUES
  ('Solo-Cal 1ª Camada (20cm)', 'm²'),
  ('Solo-Cal 2ª Camada (20cm)', 'm²'),
  ('Solo-Cal 3ª Camada (20cm)', 'm²');

-- BGS layers (2 camadas de 15cm)
INSERT INTO servicos_retigrafico (nome, unidade) VALUES
  ('BGS 1ª Camada (15cm)', 'm²'),
  ('BGS 2ª Camada (15cm)', 'm²');

-- BGTC layer (1 camada de 15cm)
INSERT INTO servicos_retigrafico (nome, unidade) VALUES
  ('BGTC 1ª Camada (15cm)', 'm²');
