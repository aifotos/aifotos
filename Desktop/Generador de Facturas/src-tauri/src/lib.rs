// `MigrationKind` se usa a partir de la Fase 2, al declarar las tablas.
use tauri_plugin_sql::Migration;

/// Migraciones de la base de datos local (SQLite).
/// Cada migracion se ejecuta una sola vez y queda registrada por su `version`.
/// Para cambiar el esquema NUNCA se edita una migracion ya publicada:
/// se agrega una nueva con la version siguiente.
fn migrations() -> Vec<Migration> {
    vec![
        // FASE 2: aqui van las tablas de clientes, servicios y facturas.
    ]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:facturapro.db", migrations())
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
