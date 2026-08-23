use tauri_plugin_sql::{Migration, MigrationKind};

/// El esquema vive en un archivo .sql aparte, no incrustado aqui, porque lo
/// comparten dos motores: SQLite nativo en la app compilada y SQLite en
/// WebAssembly cuando corres `npm run dev` en el navegador para maquetar.
/// Un solo archivo = imposible que se desincronicen.
const V1_ESQUEMA_INICIAL: &str = include_str!("../migrations/001_esquema_inicial.sql");

/// Migraciones de la base de datos local (SQLite).
///
/// Cada migracion se ejecuta una sola vez y queda registrada con un
/// CHECKSUM de su contenido. Editar una migracion ya aplicada — aunque
/// solo cambien los espacios — hace que la app falle al arrancar con:
///
///     migration 1 was previously applied but has been modified
///
/// y la unica salida es borrar la base del usuario, es decir, sus facturas.
/// Para cambiar el esquema se agrega SIEMPRE una migracion nueva con la
/// version siguiente. La v1 ya no se toca.
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
        // El registro se activa tambien en la app compilada, no solo en
        // desarrollo: cuando un usuario reporta "se quedo en blanco", el
        // archivo de log es la unica pista que hay. En desarrollo sale por
        // la terminal; compilada, escribe en ~/Library/Logs/FacturaPro/.
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(if cfg!(debug_assertions) {
                    log::LevelFilter::Info
                } else {
                    log::LevelFilter::Warn
                })
                .build(),
        )
        .setup(|_app| Ok(()))
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
