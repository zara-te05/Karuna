use bcrypt::{hash, verify, DEFAULT_COST};
use tauri::Manager;
use std::process::Command;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::mpsc;
use std::time::Duration;
use std::thread;

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
/// Corre en un hilo bloqueante dedicado para no congelar el runtime de Tokio/Tauri.
#[tauri::command]
async fn ejecutar_ml(script_path: String, datos_json: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
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
                // El binario de Python no existe en el PATH — probar el siguiente
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
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                let stdout_str = String::from_utf8_lossy(&output.stdout).to_string();

                // Si Python encontró el script pero le faltan librerias (sklearn, matplotlib, etc.)
                // devolver un JSON de error controlado para que el frontend lo muestre amigablemente.
                if stderr.contains("No module named") {
                    let module = stderr
                        .lines()
                        .find(|l| l.contains("No module named"))
                        .and_then(|l| l.split("No module named ").nth(1))
                        .map(|m| m.trim().trim_matches('\'').to_string())
                        .unwrap_or_else(|| "desconocido".to_string());
                    let json_err = format!(
                        "{{\"error\":true,\"mensaje\":\"Falta la libreria Python '{module}'. Instalala con: pip install scikit-learn matplotlib seaborn pandas numpy\"}}",
                        module = module
                    );
                    return Ok(json_err);
                }

                // Si stdout tiene contenido (el script capturo el error y lo escribio en stdout)
                if !stdout_str.trim().is_empty() {
                    return Ok(stdout_str);
                }

                // Otro error real del script — devolver JSON controlado para no
                // activar el catch generico en TypeScript ("No se pudo comunicar")
                let stderr_short: String = stderr.lines().take(5).collect::<Vec<_>>().join(" | ");
                let json_err = format!(
                    "{{\"error\":true,\"mensaje\":\"El modelo no pudo ejecutarse. Detalle: {detail}\"}}",
                    detail = stderr_short.replace('"', "'")
                );
                return Ok(json_err);
            }

            return Ok(String::from_utf8_lossy(&output.stdout).to_string());
        }

        Err(format!("Error ejecutando Python:\n{}", last_err))
    })
    .await
    .map_err(|e| format!("Error en hilo de ejecucion ML: {}", e))?
}

// ─── OAuth helpers ────────────────────────────────────────────────────────────

/// Encuentra un puerto TCP libre en localhost.
#[tauri::command]
fn obtener_puerto_libre() -> Result<u16, String> {
    TcpListener::bind("127.0.0.1:0")
        .map_err(|e| e.to_string())
        .map(|l| l.local_addr().unwrap().port())
}

/// Inicia un mini servidor HTTP en `port` y espera a que Google redirija
/// con `?code=XXXXX`. Devuelve el authorization code.
/// Timeout de 5 minutos.
#[tauri::command]
async fn esperar_codigo_oauth(port: u16) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let (tx, rx) = mpsc::channel::<Result<String, String>>();

        thread::spawn(move || {
            let result = (|| -> Result<String, String> {
                let listener = TcpListener::bind(format!("127.0.0.1:{}", port))
                    .map_err(|e| format!("No se pudo iniciar servidor OAuth: {}", e))?;

                let (mut stream, _) = listener.accept()
                    .map_err(|e| format!("Error esperando conexi\u{00f3}n: {}", e))?;

                stream.set_read_timeout(Some(Duration::from_secs(15))).ok();

                let mut buf: Vec<u8> = Vec::with_capacity(4096);
                let mut tmp = [0u8; 1024];
                loop {
                    match stream.read(&mut tmp) {
                        Ok(0) | Err(_) => break,
                        Ok(n) => {
                            buf.extend_from_slice(&tmp[..n]);
                            if buf.windows(4).any(|w| w == b"\r\n\r\n") { break; }
                            if buf.len() > 16_384 { break; }
                        }
                    }
                }

                let req = String::from_utf8_lossy(&buf);
                // GET /?code=XXX&... HTTP/1.1
                let path = req.lines()
                    .next()
                    .and_then(|l| l.split_whitespace().nth(1))
                    .unwrap_or("");

                let query = path.split('?').nth(1).unwrap_or("");

                // Check for error from Google
                if let Some(err_param) = query.split('&').find(|p| p.starts_with("error=")) {
                    let err_val = &err_param["error=".len()..];
                    // Still send a response
                    let html = format!("<html><body style='font-family:sans-serif;text-align:center;padding:80px'><h2>\u{274c} Acceso denegado</h2><p>{}</p></body></html>", err_val);
                    let resp = format!("HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", html.len(), html);
                    stream.write_all(resp.as_bytes()).ok();
                    return Err(format!("Google deneg\u{00f3} el acceso: {}", err_val));
                }

                let raw_code = query.split('&')
                    .find(|p| p.starts_with("code="))
                    .map(|p| p["code=".len()..].to_string())
                    .ok_or_else(|| "No se encontr\u{00f3} el c\u{00f3}digo de autorizaci\u{00f3}n en la respuesta".to_string())?;

                // URL-decode common encoded chars in the code
                let code = raw_code
                    .replace("%2F", "/")
                    .replace("%2B", "+")
                    .replace("%3D", "=")
                    .replace("%2C", ",")
                    .replace("%7C", "|");

                // Send success page to the browser
                let html = "<html><head><meta charset=utf-8></head><body style='font-family:sans-serif;text-align:center;padding:80px;background:#f8fafc'>\
                    <div style='font-size:52px'>\u{2705}</div>\
                    <h2 style='color:#1b5e20;margin:16px 0 8px'>\u{00a1}Autorizaci\u{00f3}n exitosa!</h2>\
                    <p style='color:#555'>Puedes cerrar esta pesta\u{00f1}a y regresar a Karuna.</p>\
                    </body></html>";
                let resp = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    html.len(), html
                );
                stream.write_all(resp.as_bytes()).ok();

                Ok(code)
            })();
            tx.send(result).ok();
        });

        rx.recv_timeout(Duration::from_secs(300))
            .map_err(|_| "Timeout: El proceso de autorizaci\u{00f3}n tard\u{00f3} demasiado. Intenta de nuevo.".to_string())?
    })
    .await
    .map_err(|e| format!("Error en espera de servidor OAuth: {}", e))?
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
            obtener_puerto_libre,
            esperar_codigo_oauth,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
