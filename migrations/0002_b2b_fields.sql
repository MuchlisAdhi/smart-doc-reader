-- Add B2B invoice fields
ALTER TABLE documents ADD COLUMN vendor_address TEXT;
ALTER TABLE documents ADD COLUMN buyer TEXT;
ALTER TABLE documents ADD COLUMN buyer_address TEXT;
ALTER TABLE documents ADD COLUMN due_date TEXT;
ALTER TABLE documents ADD COLUMN tax_rate TEXT;
ALTER TABLE documents ADD COLUMN discount REAL;
ALTER TABLE documents ADD COLUMN shipping REAL;
ALTER TABLE documents ADD COLUMN payment_method TEXT;
ALTER TABLE documents ADD COLUMN payment_terms TEXT;

-- Add SKU and unit to items
ALTER TABLE document_items ADD COLUMN sku TEXT;
ALTER TABLE document_items ADD COLUMN unit TEXT;
ALTER TABLE document_items ADD COLUMN discount REAL;
