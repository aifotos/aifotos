use tauri_plugin_sql::{Migration, MigrationKind};

/// El esquema vive en un archivo .sql aparte, no incrustado aqui, porque lo
/// comparten dos motores: SQLite nativo en la app compilada y SQLite en
/// WebAssembly cuando corres `npm run dev` en el navegador para maquetar.
/// Un solo archivo = imposible que se desincronicen.
const V1_ESQUEMA_INICIAL: &str = include_str!("../migrations/001_esquema_inicial.sql");

/// Migraciones de la base de datos local (SQLite).
/// Cada migracion se ejecuta una sola vez y queda registrada por su `version`.
/// Para cambiar el esquema NUNCA se edita una migracion ya publicada:
/// se agrega una nueva con la version siguiente.
fn migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "esquema inicial: settings, clients, services, invoices, invoice_items",
        sql: V1_ESQUEMA_INICIAL,
        kind: MigrationKind::Up,
    }]
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
