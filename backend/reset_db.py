import os
import sys
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

DB_NAME = "parcial_db"
HOST = os.getenv("PG_HOST", "localhost")
PORT = int(os.getenv("PG_PORT", "5432"))
USER = os.getenv("PG_USER", "postgres")
PASSWORD = os.getenv("PG_PASSWORD", "postgres")


def main():
    print(f"Conectando a {USER}@{HOST}:{PORT}...")
    try:
        conn = psycopg2.connect(
            host=HOST, port=PORT, user=USER, password=PASSWORD, dbname="postgres"
        )
    except psycopg2.OperationalError as e:
        print(f"ERROR de conexion: {e}")
        print("Verifica que PostgreSQL este corriendo y que el password sea correcto.")
        print("Podes setear PG_PASSWORD como variable de entorno.")
        sys.exit(1)
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cur = conn.cursor()
    print(f"DROP DATABASE IF EXISTS {DB_NAME}...")
    cur.execute(
        f"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = %s AND pid <> pg_backend_pid();",
        (DB_NAME,),
    )
    cur.execute(f"DROP DATABASE IF EXISTS {DB_NAME};")
    print(f"CREATE DATABASE {DB_NAME}...")
    cur.execute(f"CREATE DATABASE {DB_NAME};")
    cur.close()
    conn.close()
    print("OK. Listo para arrancar uvicorn.")


if __name__ == "__main__":
    main()
