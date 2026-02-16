// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use bcrypt::{hash, verify, DEFAULT_COST};

#[tauri::command]
fn hashear_password(password: String) -> Result<String, String>{
    hash(password, DEFAULT_COST)
    .map_err(|e| format!("Error al verificar: {}", e))
}

#[tauri::command]
fn verificar_password(password: String, hash_guardado: String) -> Result<bool, String>{
    verify(password, &hash_guardado)
    .map_err(|e| format!("Error al verificar: {}", e))
}


#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            greet,
            hashear_password,
            verificar_password
            ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
