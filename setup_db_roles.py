import asyncio
import logging
from urllib.parse import quote_plus
from azure.identity import DefaultAzureCredential
import asyncpg

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# Config
DB_HOST = "pgsql-22o4pc.postgres.database.azure.com"
ENTRA_ADMIN_USER = "FlowForge-DevOps"

DEV_DB = "flowforge-dev"
PROD_DB = "flowforge-prod"

# SQL Commands for DEV
DEV_SQL = """
-- Create roles
SELECT * FROM pgaadauth_create_principal('mi-flowforge-app-dev', false, false);
SELECT * FROM pgaadauth_create_principal('mi-ai-dev-m9mp04', false, false);

-- Grant privileges for app dev
GRANT ALL ON ALL TABLES IN SCHEMA public TO "mi-flowforge-app-dev";
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO "mi-flowforge-app-dev";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO "mi-flowforge-app-dev";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO "mi-flowforge-app-dev";

-- Grant privileges for AI dev
GRANT ALL ON ALL TABLES IN SCHEMA public TO "mi-ai-dev-m9mp04";
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO "mi-ai-dev-m9mp04";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO "mi-ai-dev-m9mp04";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO "mi-ai-dev-m9mp04";
"""

# SQL Commands for PROD
PROD_SQL = """
-- Create roles
SELECT * FROM pgaadauth_create_principal('mi-flowforge-app-prod', false, false);
SELECT * FROM pgaadauth_create_principal('mi-ai-prod-m9mp04', false, false);

-- Grant privileges for app prod
GRANT ALL ON ALL TABLES IN SCHEMA public TO "mi-flowforge-app-prod";
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO "mi-flowforge-app-prod";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO "mi-flowforge-app-prod";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO "mi-flowforge-app-prod";

-- Grant privileges for AI prod
GRANT ALL ON ALL TABLES IN SCHEMA public TO "mi-ai-prod-m9mp04";
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO "mi-ai-prod-m9mp04";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO "mi-ai-prod-m9mp04";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO "mi-ai-prod-m9mp04";
"""

async def get_token() -> str:
    logger.info("Acquiring Entra ID Token via DefaultAzureCredential...")
    credential = DefaultAzureCredential()
    token = credential.get_token("https://ossrdbms-aad.database.windows.net/.default")
    return token.token

async def execute_setup(db_name: str, sql_commands: str, token: str):
    logger.info(f"Connecting to {db_name} as {ENTRA_ADMIN_USER}...")
    
    # Construct connection string
    user = quote_plus(ENTRA_ADMIN_USER)
    password = quote_plus(token)
    conn_url = f"postgresql://{user}:{password}@{DB_HOST}:5432/{db_name}?sslmode=require"
    
    try:
        # Connect to Postgres
        conn = await asyncpg.connect(conn_url)
        logger.info(f"Successfully connected to {db_name}!")
        
        # Execute the SQL block
        logger.info(f"Executing Entra ID Role setup on {db_name}...")
        
        # We split by statements and execute them individually to avoid asyncpg multi-statement errors
        for statement in sql_commands.split(';'):
            statement = statement.strip()
            if statement:
                try:
                    await conn.execute(statement)
                    logger.info(f"Executed: {statement.splitlines()[0]}...")
                except asyncpg.exceptions.DuplicateObjectError:
                    logger.warning(f"Role already exists, skipping...")
                except Exception as e:
                    logger.warning(f"Notice/Error on statement '{statement[:30]}...': {e}")
                    
        await conn.close()
        logger.info(f"Finished setup for {db_name}!\n")
    except Exception as e:
        logger.error(f"Failed to connect or execute on {db_name}: {e}")

async def main():
    try:
        token = await get_token()
    except Exception as e:
        logger.error(f"Failed to get Azure Token. Make sure you are logged in via 'az login'. Error: {e}")
        return

    # Setup DEV
    await execute_setup(DEV_DB, DEV_SQL, token)
    
    # Setup PROD
    await execute_setup(PROD_DB, PROD_SQL, token)
    
    logger.info("All Database configurations completed.")

if __name__ == "__main__":
    asyncio.run(main())
