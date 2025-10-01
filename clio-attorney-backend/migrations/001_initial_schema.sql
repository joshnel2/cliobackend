-- Initial database schema for Clio Attorney Payout System
-- Run this to create the database structure

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Attorneys table
CREATE TABLE IF NOT EXISTS attorneys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clio_id VARCHAR(255) NOT NULL,
    firm_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    email VARCHAR(255),
    hourly_rate DECIMAL(10,2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(clio_id, firm_id)
);

-- Matters table
CREATE TABLE IF NOT EXISTS matters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clio_id VARCHAR(255) NOT NULL,
    firm_id VARCHAR(255) NOT NULL,
    display_number VARCHAR(255),
    description TEXT,
    status VARCHAR(100),
    client_name VARCHAR(255),
    originating_attorney_id UUID REFERENCES attorneys(id),
    responsible_attorney_id UUID REFERENCES attorneys(id),
    total_collected DECIMAL(12,2) DEFAULT 0,
    total_billed DECIMAL(12,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(clio_id, firm_id)
);

-- Bills table
CREATE TABLE IF NOT EXISTS bills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clio_id VARCHAR(255) NOT NULL,
    firm_id VARCHAR(255) NOT NULL,
    matter_id UUID REFERENCES matters(id),
    number VARCHAR(255),
    total DECIMAL(12,2) DEFAULT 0,
    status VARCHAR(100),
    issued_at TIMESTAMP,
    due_at TIMESTAMP,
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(clio_id, firm_id)
);

-- Time entries table
CREATE TABLE IF NOT EXISTS time_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clio_id VARCHAR(255) NOT NULL,
    firm_id VARCHAR(255) NOT NULL,
    matter_id UUID REFERENCES matters(id),
    attorney_id UUID REFERENCES attorneys(id),
    date DATE NOT NULL,
    quantity DECIMAL(8,2) NOT NULL, -- hours worked
    rate DECIMAL(10,2) NOT NULL,
    total DECIMAL(12,2) NOT NULL,
    billable BOOLEAN DEFAULT true,
    description TEXT,
    activity_description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(clio_id, firm_id)
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clio_id VARCHAR(255) NOT NULL,
    firm_id VARCHAR(255) NOT NULL,
    matter_id UUID REFERENCES matters(id),
    bill_id UUID REFERENCES bills(id),
    amount DECIMAL(12,2) NOT NULL,
    date DATE NOT NULL,
    method VARCHAR(100),
    status VARCHAR(100),
    reference VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(clio_id, firm_id)
);

-- Algorithm runs table (for tracking algorithm executions)
CREATE TABLE IF NOT EXISTS algorithm_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id VARCHAR(255) NOT NULL,
    algorithm_id VARCHAR(255) NOT NULL,
    run_date TIMESTAMP NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
    records_processed INTEGER DEFAULT 0,
    errors TEXT,
    execution_time_ms INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payout calculations table (stores all payout calculations)
CREATE TABLE IF NOT EXISTS payout_calculations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id VARCHAR(255) NOT NULL,
    attorney_id UUID REFERENCES attorneys(id),
    matter_id UUID REFERENCES matters(id),
    algorithm_run_id UUID REFERENCES algorithm_runs(id),
    calculation_type VARCHAR(50) NOT NULL CHECK (calculation_type IN ('originating', 'working', 'referral', 'bonus')),
    base_amount DECIMAL(12,2) NOT NULL,
    percentage DECIMAL(5,2) NOT NULL,
    calculated_amount DECIMAL(12,2) NOT NULL,
    formula_used TEXT,
    variables_used JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_attorneys_firm_id ON attorneys(firm_id);
CREATE INDEX IF NOT EXISTS idx_attorneys_clio_id ON attorneys(clio_id);
CREATE INDEX IF NOT EXISTS idx_attorneys_active ON attorneys(firm_id, is_active);

CREATE INDEX IF NOT EXISTS idx_matters_firm_id ON matters(firm_id);
CREATE INDEX IF NOT EXISTS idx_matters_clio_id ON matters(clio_id);
CREATE INDEX IF NOT EXISTS idx_matters_originating_attorney ON matters(originating_attorney_id);
CREATE INDEX IF NOT EXISTS idx_matters_status ON matters(firm_id, status);

CREATE INDEX IF NOT EXISTS idx_bills_firm_id ON bills(firm_id);
CREATE INDEX IF NOT EXISTS idx_bills_matter_id ON bills(matter_id);
CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(firm_id, status);

CREATE INDEX IF NOT EXISTS idx_time_entries_firm_id ON time_entries(firm_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_attorney_id ON time_entries(attorney_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_matter_id ON time_entries(matter_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_date ON time_entries(firm_id, date);
CREATE INDEX IF NOT EXISTS idx_time_entries_billable ON time_entries(firm_id, billable);

CREATE INDEX IF NOT EXISTS idx_payments_firm_id ON payments(firm_id);
CREATE INDEX IF NOT EXISTS idx_payments_matter_id ON payments(matter_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(firm_id, date);

CREATE INDEX IF NOT EXISTS idx_algorithm_runs_firm_id ON algorithm_runs(firm_id);
CREATE INDEX IF NOT EXISTS idx_algorithm_runs_date ON algorithm_runs(firm_id, run_date);

CREATE INDEX IF NOT EXISTS idx_payout_calculations_firm_id ON payout_calculations(firm_id);
CREATE INDEX IF NOT EXISTS idx_payout_calculations_attorney_id ON payout_calculations(attorney_id);
CREATE INDEX IF NOT EXISTS idx_payout_calculations_matter_id ON payout_calculations(matter_id);
CREATE INDEX IF NOT EXISTS idx_payout_calculations_run_id ON payout_calculations(algorithm_run_id);
CREATE INDEX IF NOT EXISTS idx_payout_calculations_type ON payout_calculations(firm_id, calculation_type);
CREATE INDEX IF NOT EXISTS idx_payout_calculations_date ON payout_calculations(firm_id, created_at);

-- Views for common queries
CREATE OR REPLACE VIEW attorney_payout_summary AS
SELECT 
    a.id,
    a.firm_id,
    a.name,
    a.email,
    COALESCE(SUM(CASE WHEN pc.calculation_type = 'originating' THEN pc.calculated_amount ELSE 0 END), 0) as originating_total,
    COALESCE(SUM(CASE WHEN pc.calculation_type = 'working' THEN pc.calculated_amount ELSE 0 END), 0) as working_total,
    COALESCE(SUM(CASE WHEN pc.calculation_type = 'referral' THEN pc.calculated_amount ELSE 0 END), 0) as referral_total,
    COALESCE(SUM(CASE WHEN pc.calculation_type = 'bonus' THEN pc.calculated_amount ELSE 0 END), 0) as bonus_total,
    COALESCE(SUM(pc.calculated_amount), 0) as total_payout,
    COUNT(DISTINCT pc.matter_id) as matters_count,
    COUNT(pc.id) as calculations_count
FROM attorneys a
LEFT JOIN payout_calculations pc ON a.id = pc.attorney_id
WHERE a.is_active = true
GROUP BY a.id, a.firm_id, a.name, a.email;

CREATE OR REPLACE VIEW matter_payout_breakdown AS
SELECT 
    m.id,
    m.firm_id,
    m.display_number,
    m.description,
    m.total_collected,
    m.total_billed,
    m.status,
    oa.name as originating_attorney_name,
    ra.name as responsible_attorney_name,
    COALESCE(SUM(pc.calculated_amount), 0) as total_payouts,
    COUNT(DISTINCT pc.attorney_id) as attorneys_count,
    COUNT(pc.id) as calculations_count
FROM matters m
LEFT JOIN attorneys oa ON m.originating_attorney_id = oa.id
LEFT JOIN attorneys ra ON m.responsible_attorney_id = ra.id
LEFT JOIN payout_calculations pc ON m.id = pc.matter_id
WHERE m.is_active = true
GROUP BY m.id, m.firm_id, m.display_number, m.description, m.total_collected, 
         m.total_billed, m.status, oa.name, ra.name;

-- Functions for data aggregation
CREATE OR REPLACE FUNCTION get_attorney_monthly_payouts(
    p_firm_id VARCHAR(255),
    p_attorney_id UUID,
    p_start_date DATE,
    p_end_date DATE
) RETURNS TABLE (
    month DATE,
    originating_amount DECIMAL(12,2),
    working_amount DECIMAL(12,2),
    referral_amount DECIMAL(12,2),
    total_amount DECIMAL(12,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        DATE_TRUNC('month', pc.created_at)::DATE as month,
        SUM(CASE WHEN pc.calculation_type = 'originating' THEN pc.calculated_amount ELSE 0 END) as originating_amount,
        SUM(CASE WHEN pc.calculation_type = 'working' THEN pc.calculated_amount ELSE 0 END) as working_amount,
        SUM(CASE WHEN pc.calculation_type = 'referral' THEN pc.calculated_amount ELSE 0 END) as referral_amount,
        SUM(pc.calculated_amount) as total_amount
    FROM payout_calculations pc
    WHERE pc.firm_id = p_firm_id
        AND pc.attorney_id = p_attorney_id
        AND pc.created_at::DATE BETWEEN p_start_date AND p_end_date
    GROUP BY DATE_TRUNC('month', pc.created_at)
    ORDER BY month;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to all tables
CREATE TRIGGER update_attorneys_updated_at BEFORE UPDATE ON attorneys FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_matters_updated_at BEFORE UPDATE ON matters FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bills_updated_at BEFORE UPDATE ON bills FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_time_entries_updated_at BEFORE UPDATE ON time_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();