// Evita que se abra una consola extra en Windows en release. NO BORRAR.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    facturapro_lib::run();
}
