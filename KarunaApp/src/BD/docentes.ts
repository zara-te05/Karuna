import Database from '@tauri-apps/plugin-sql';
import { invoke } from '@tauri-apps/api/core';

let db: Database | null = null;

export async function initDatabase() {
    if (db) return db;
    
    db = await Database.load('sqlite:karuna.db');
    
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

export async function registrarUsuario(
    email: string, 
    password: string, 
    nombre: string, 
    apellido: string, 
    institucion?: string
) {
    const database = await initDatabase();
    
    try {
        // Hashear contraseña usando Rust
        const passwordHasheado = await invoke<string>('hashear_password', { password });
        
        // Guardar contraseña hasheada en la BD
        await database.execute(
            'INSERT INTO DOCENTE(email, password, nombre, apellido, institucion) VALUES(?,?,?,?,?)',
            [email, passwordHasheado, nombre, apellido, institucion || null]
        );
        
        return { success: true };
    } catch (error) {
        console.error('Error al registrar usuario:', error);
        return { success: false, error: 'El email ya está registrado' };
    }
}

export async function loginDocente(email: string, password: string) {
    const database = await initDatabase();
    
    // Obtener el hash de la contraseña de la BD
    const docentes = await database.select<Array<{
        id: number,
        email: string,
        password: string,  // ← Ahora necesitamos el hash
        nombre: string,
        apellido: string
    }>>(
        'SELECT id, email, password, nombre, apellido FROM DOCENTE WHERE email = ?',
        [email]
    );
    
    if (docentes.length === 0) {
        return { success: false, error: 'Email o contraseña incorrectos' };
    }
    
    const docente = docentes[0];
    
    const passwordValido = await invoke<boolean>('verificar_password', {
        password,
        hashGuardado: docente.password
    });
    
    if (passwordValido) {
        // No incluir la contraseña en la respuesta
        return { 
            success: true, 
            docente: {
                id: docente.id,
                email: docente.email,
                nombre: docente.nombre,
                apellido: docente.apellido
            }
        };
    }
    
    return { success: false, error: 'Email o contraseña incorrectos' };
}

export async function obtenerDocentePorID(id: number) {
    try {
        const database = await initDatabase();
        const resultados = await database.select<any[]>(
            `SELECT nombre, apellido FROM DOCENTE WHERE id = ?`,
            [id]
        );
        return resultados.length > 0 ? resultados[0] : null;
    } catch (error) {
        console.error("Error crítico al leer SQLite:", error);
        return null;
    }
}

export async function actualizarDocente(nombre: string, apellido: string, id: number) {
    try {
        const database = await initDatabase();
        await database.execute(
            `UPDATE DOCENTE SET nombre = ?, apellido = ? WHERE id = ?`,
            [nombre, apellido, id]
        );
        return { success: true };
    } catch (error) {
        console.error(error);
        return { success: false, error };
    }
}