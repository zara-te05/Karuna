use bcrypt::{hash, verify, DEFAULT_COST};
use tauri::Manager;
use std::process::Command;
use std::io::Write;

#[tauri::command]
fn hashear_password(password: String) -> Result<String, String> {
    hash(password, DEFAULT_COST).map_err(|e| format!("Error al hashear: {}", e))
}

#[tauri::command]
fn verificar_password(password: String, hash_guardado: String) -> Result<bool, String> {
    verify(password, &hash_guardado).map_err(|e| format!("Error al verificar: {}", e))
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// Ejecuta un script de ML de Python, le pasa datos_json por stdin
/// y devuelve el stdout (JSON con { imagen, resumen }).
#[tauri::command]
fn ejecutar_ml(script_path: String, datos_json: String) -> Result<String, String> {
    // Resolver path absoluto (Tauri a veces corre en src-tauri, a veces en root)
    let mut resolved_path = std::path::PathBuf::from(&script_path);
    if !resolved_path.exists() {
        // En dev, suele estar en el nivel superior de src-tauri
        let alt_path = std::path::PathBuf::from("..").join(&script_path);
        if alt_path.exists() {
            resolved_path = alt_path;
        }
    }

    let absolute_script_path = match resolved_path.canonicalize() {
        Ok(p) => p.to_string_lossy().to_string(),
        Err(_) => script_path.clone(), // Fallback si falla
    };

    // Remover el prefijo \\?\ de canonicalize en Windows para evitar errores en ciertos Python
    let clean_script_path = absolute_script_path.strip_prefix(r"\\?\").unwrap_or(&absolute_script_path).to_string();

    let python_cmds = if cfg!(target_os = "windows") {
        vec!["py", "python", "python3"]
    } else {
        vec!["python3", "python"]
    };

    let mut last_err = String::new();

    for py in &python_cmds {
        let mut child = match Command::new(py)
            .arg(&clean_script_path)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
        {
            Ok(c) => c,
            Err(e) => { last_err = format!("{}: {}", py, e); continue; }
        };

        if let Some(mut stdin) = child.stdin.take() {
            if let Err(e) = stdin.write_all(datos_json.as_bytes()) {
                return Err(format!("Error escribiendo stdin: {}", e));
            }
        }

        let output = match child.wait_with_output() {
            Ok(o) => o,
            Err(e) => return Err(format!("Error esperando proceso: {}", e)),
        };

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            // Si el error es simplemente que no encontró el comando/módulo, iterar al siguiente python
            if stderr.contains("No module named") || stderr.contains("not found") {
                last_err = format!("{} Python falló: {}", py, stderr.trim());
                continue;
            }
            return Err(format!("Script falló:\n{}", stderr));
        }

        return Ok(String::from_utf8_lossy(&output.stdout).to_string());
    }

    Err(format!("Error ejecutando Python:\n{}", last_err))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            greet,
            hashear_password,
            verificar_password,
            ejecutar_ml,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
