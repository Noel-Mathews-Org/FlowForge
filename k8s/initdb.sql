CREATE DATABASE auth_db;
CREATE DATABASE project_db;
CREATE DATABASE task_db;
CREATE DATABASE analytics_db;

-- Connect to auth_db
\c auth_db

-- Create the user_role type if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('admin', 'manager', 'member');
    END IF;
END $$;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    org VARCHAR(255) NOT NULL DEFAULT 'flowforge',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Insert test users (password is 'password123' hashed)
INSERT INTO users (email, hashed_password, full_name, role) VALUES
('admin@stratum.com', '$2b$12$LQvPHFaUD9zUMZe.8SDeNuS3vU9sK1F2S3vU9sK1F2S3vU9sK1F2', 'Admin User', 'admin'),
('manager@stratum.com', '$2b$12$LQvPHFaUD9zUMZe.8SDeNuS3vU9sK1F2S3vU9sK1F2S3vU9sK1F2', 'Manager User', 'manager'),
('user@stratum.com', '$2b$12$LQvPHFaUD9zUMZe.8SDeNuS3vU9sK1F2S3vU9sK1F2S3vU9sK1F2', 'Regular User', 'member')
ON CONFLICT (email) DO NOTHING;
