use tauri_plugin_sql::{Migration, MigrationKind};

/// La unica base de datos de la app. Debe coincidir con la cadena que usa
/// `Database.load()` en src/db/index.js y con `add_migrations` de abajo.
const BASE_DE_DATOS: &str = "sqlite:facturapro.db";

/// El esquema vive en un archivo .sql aparte, no incrustado aqui, porque lo
/// comparten dos motores: SQLite nativo en la app compilada y SQLite en
/// WebAssembly cuando corres `npm run dev` en el navegador para maquetar.
/// Un solo archivo = imposible que se desincronicen.
const V1_ESQUEMA_INICIAL: &str = include_str!("../migrations/001_esquema_inicial.sql");
const V2_NUMERACION_BORRADORES: &str =
    include_str!("../migrations/002_numeracion_de_borradores.sql");
const V3_COTIZACIONES: &str = include_str!("../migrations/003_cotizaciones.sql");
const V4_CUENTAS_E_IMPUESTOS: &str = include_str!("../migrations/004_cuentas_e_impuestos.sql");

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
    vec![
        Migration {
            version: 1,
            description: "esquema inicial: settings, clients, services, invoices, invoice_items",
            sql: V1_ESQUEMA_INICIAL,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "secuencia aparte para los numeros de borrador",
            sql: V2_NUMERACION_BORRADORES,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "cotizaciones: columna kind, estados propios y vistas separadas",
            sql: V3_COTIZACIONES,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "cuentas separadas, impuestos y retenciones, formato del documento",
            sql: V4_CUENTAS_E_IMPUESTOS,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "costos, abonos y conversion atomica",
            sql: include_str!("../migrations/005_costos_y_pagos.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

/// Una sentencia SQL con sus parametros, tal como la manda `src/db/index.js`.
#[derive(serde::Deserialize)]
struct Sentencia {
    sql: String,
    #[serde(default)]
    params: Vec<serde_json::Value>,
}

/// Ejecuta varias sentencias como UNA transaccion real.
///
/// Existe porque la API JS de tauri-plugin-sql NO permite transacciones:
/// abre un pool de hasta 10 conexiones y reparte cada `execute` por la que
/// tenga libre. Un `BEGIN` desde JS se queda en una conexion, los INSERT
/// van por otras y el `COMMIT` por una cuarta — no agrupa absolutamente
/// nada. Comprobado con una sonda: la fila insertada tras un BEGIN ya era
/// visible desde otra conexion antes del COMMIT, y el ROLLBACK fallaba con
/// "cannot rollback - no transaction is active".
///
/// El sintoma en la app eran facturas guardadas a medias: la cabecera con
/// su total y sin ninguna linea, porque cada sentencia se confirmaba sola
/// y bastaba que una fallara para dejar el resto escrito.
///
/// Aqui se coge el MISMO pool del plugin y se pide una conexion unica con
/// `pool.begin()`, que es lo que sqlx entiende por transaccion.
#[tauri::command]
async fn ejecutar_atomico(
    instancias: tauri::State<'_, tauri_plugin_sql::DbInstances>,
    sentencias: Vec<Sentencia>,
) -> Result<(), String> {
    let mapa = instancias.0.read().await;
    // Los accesores `sqlite()` del plugin estan comentados en el crate, pero
    // la enum y su variante son publicas, asi que se saca por patron. Solo
    // hay una variante porque el crate se compila con la feature "sqlite"
    // y nada mas.
    let pool = match mapa.get(BASE_DE_DATOS) {
        Some(tauri_plugin_sql::DbPool::Sqlite(pool)) => pool,
        None => return Err(format!("La base {BASE_DE_DATOS} no esta abierta")),
    };

    ejecutar_en_pool(pool, sentencias).await
}

async fn ejecutar_en_pool(
    pool: &sqlx::SqlitePool,
    sentencias: Vec<Sentencia>,
) -> Result<(), String> {
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    for sentencia in sentencias {
        let mut consulta = sqlx::query(&sentencia.sql);
        for p in sentencia.params {
            consulta = enlazar(consulta, p);
        }
        consulta
            .execute(&mut *tx)
            .await
            // Si algo falla, `tx` se descarta al salir y sqlx deshace todo.
            .map_err(|e| format!("{e}  —  en: {}", resumen(&sentencia.sql)))?;
    }

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(())
}

/// Traduce un valor JSON al tipo que espera SQLite.
fn enlazar<'q>(
    consulta: sqlx::query::Query<'q, sqlx::Sqlite, sqlx::sqlite::SqliteArguments<'q>>,
    valor: serde_json::Value,
) -> sqlx::query::Query<'q, sqlx::Sqlite, sqlx::sqlite::SqliteArguments<'q>> {
    use serde_json::Value;
    match valor {
        Value::Null => consulta.bind(None::<String>),
        Value::Bool(b) => consulta.bind(b),
        Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                consulta.bind(i)
            } else {
                consulta.bind(n.as_f64().unwrap_or(0.0))
            }
        }
        Value::String(s) => consulta.bind(s),
        // Arrays y objetos no aparecen en el esquema; se guardan como texto
        // en vez de fallar en silencio con un NULL.
        otro => consulta.bind(otro.to_string()),
    }
}

/// Primeros caracteres de una sentencia, para que el mensaje de error diga
/// cual de todas fallo sin volcar un SQL de veinte lineas al log.
fn resumen(sql: &str) -> String {
    let limpio: String = sql.split_whitespace().collect::<Vec<_>>().join(" ");
    limpio.chars().take(70).collect()
}

/// Abre el dialogo de impresion nativo de macOS.
///
/// `window.print()` del navegador NO sirve aqui: WKWebView lo declara como
/// funcion pero no hace nada — retorna en 1 ms y no dispara ni `beforeprint`
/// ni `afterprint`. Comprobado. La impresion hay que pedirla desde Rust,
/// donde Tauri llama al motor de impresion del sistema.
///
/// Desde ahi el usuario elige "PDF > Guardar como PDF", que produce un PDF
/// con texto real: seleccionable, buscable y nitido a cualquier zoom.
#[tauri::command]
fn imprimir(webview: tauri::WebviewWindow) -> Result<(), String> {
    webview.print().map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(BASE_DE_DATOS, migrations())
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
        .invoke_handler(tauri::generate_handler![imprimir, ejecutar_atomico])
        .setup(|_app| Ok(()))
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sqlite_nativo_pagos_y_rollback() {
        tauri::async_runtime::block_on(async {
            let pool = sqlx::sqlite::SqlitePoolOptions::new()
                .max_connections(5)
                .connect("sqlite::memory:")
                .await
                .unwrap();
            for migration in migrations() {
                sqlx::raw_sql(migration.sql).execute(&pool).await.unwrap();
            }
            sqlx::raw_sql("UPDATE sesion SET account_id=1; INSERT INTO invoices(account_id,number,kind,issue_date,status,total_cents) VALUES(1,'TEST','invoice','2026-09-16','pending',10000)")
                .execute(&pool).await.unwrap();
            let statement = |sql: &str| Sentencia {
                sql: sql.into(),
                params: vec![],
            };
            let insert = "INSERT INTO payments(id,invoice_id,amount_cents,paid_on) VALUES('test',1,3000,'2026-09-16')";
            let failed = ejecutar_en_pool(
                &pool,
                vec![
                    statement(insert),
                    statement("INSERT INTO missing_table VALUES (1)"),
                ],
            )
            .await;
            assert!(failed.is_err());
            let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM payments")
                .fetch_one(&pool)
                .await
                .unwrap();
            assert_eq!(count.0, 0);
            ejecutar_en_pool(&pool, vec![statement(insert)])
                .await
                .unwrap();
            let excess = ejecutar_en_pool(&pool,vec![statement("INSERT INTO payments(id,invoice_id,amount_cents,paid_on) VALUES('excess',1,8000,'2026-09-16')")]).await;
            assert!(excess.is_err());
            ejecutar_en_pool(&pool,vec![statement("INSERT INTO payments(id,invoice_id,amount_cents,paid_on) VALUES('rest',1,7000,'2026-09-16')")]).await.unwrap();
            let status: (String,) = sqlx::query_as("SELECT status FROM invoices WHERE id=1")
                .fetch_one(&pool)
                .await
                .unwrap();
            assert_eq!(status.0, "paid");
            pool.close().await;
        });
    }
}
