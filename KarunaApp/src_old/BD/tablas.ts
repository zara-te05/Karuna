import Database from '@tauri-apps/plugin-sql';

let db: Database | null = null;

export async function initDatabase() {
    
    if (db) return db;

    // Crea o abre la base de datos
    db = await Database.load('sqlite:karuna.db');

    //Crear tablas

    await db.execute(`
        
            CREATE TABLE IF NOT EXISTS DOCENTE(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL,
                nombre TEXT,
                apellido TEXT,
                institucion TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        
        `);
    
   console.log('Base de datos inicializada');
   return db;
}

export async function registrarUsuario(email:string, passowrd:string, nombre:string, apellido:string, institucion?: string){

    const database = await initDatabase();

    try{
        await database.execute(
            `
                INSERT INTO DOCENTE(email, password, nombre, apellido, institucion) values(?,?,?,?,?),
            `,

            [email, passowrd, nombre, apellido, institucion || null]
        );

        return {success: true};
    } 
    catch(error){
        console.error('Error al registrar usuario:', error);

        return {success : false, error: 'El email ya esta registrado'}
    }

}

export async function loginDocente(email:string, password:string){

    const database = await initDatabase();

    const docentes = await database.select<Array<{
        id:number,
        email:string,
        nombre:string,
        apellido:string
    }>>(
        'SELECT id, email, nombre, apellido FROM USUARIOS WHERE email = ? AND password = ?',
        [email, password]
    );

    if(docentes.length > 0) {
        return {success: true, docente: docentes[0]};
    }

    return { success : false, error : "Email o clave incorrectos"};

}


