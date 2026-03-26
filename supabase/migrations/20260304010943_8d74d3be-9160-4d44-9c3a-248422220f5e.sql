
-- Delete existing taxi trechos
DELETE FROM trechos_retigrafico 
WHERE obra_id = '03e58aa0-85d9-424f-b412-f139c7b0ec47' 
  AND faixa IN ('Taxi A Esq', 'Taxi A Dir', 'Taxi B Esq', 'Taxi B Dir');

-- Insert Taxi A and Taxi B trechos: E0 to E18 (19 stakes each, 4 faixas)
-- Taxi A anchors at PPD estaca 27, Taxi B at PPD estaca 31
-- Each taxi goes from E0 to E18 "upward" (perpendicular)
INSERT INTO trechos_retigrafico (obra_id, estaca_inicial, estaca_final, faixa, secao, area_total, extensao, ordem)
SELECT 
  '03e58aa0-85d9-424f-b412-f139c7b0ec47',
  'E' || s.num,
  'E' || (s.num + 1),
  f.faixa,
  NULL,
  230,
  20,
  CASE 
    WHEN f.faixa = 'Taxi A Esq' THEN 10000 + s.num
    WHEN f.faixa = 'Taxi A Dir' THEN 10100 + s.num
    WHEN f.faixa = 'Taxi B Esq' THEN 10200 + s.num
    WHEN f.faixa = 'Taxi B Dir' THEN 10300 + s.num
  END
FROM generate_series(0, 17) AS s(num)
CROSS JOIN (VALUES ('Taxi A Esq'), ('Taxi A Dir'), ('Taxi B Esq'), ('Taxi B Dir')) AS f(faixa);
