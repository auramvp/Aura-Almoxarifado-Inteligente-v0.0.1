-- Adicionar colunas faltantes para Nota Fiscal na tabela de movimentações
-- Isso corrige o problema de "Data de Emissão" e "Valor da NF" não aparecerem

ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS invoice_date DATE;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS invoice_value DECIMAL(10,2);

NOTIFY pgrst, 'reload schema';
