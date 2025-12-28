import psycopg2

def obtener_conexion():
    try:
        conn = psycopg2.connect(
            database='Karuna',
            host='localhost',
            user='postgres',
            password='admin',
            port='5432'
        )
        
        print('Conexion exitosa')
        return conn
    
    except Exception as a:
        print(f'Error: {a}')
        return None
        
obtener_conexion()

