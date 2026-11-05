mod files;
mod scryfall;

use scryfall::Scryfall;
use serde_json::Value;
use tauri::State;

/// Search cards. `unique` is "prints", "cards" or "art"; `order`/`dir` follow Scryfall's names.
#[tauri::command]
async fn scryfall_search(
    scryfall: State<'_, Scryfall>,
    query: String,
    unique: String,
    order: String,
    dir: String,
    page: u32,
) -> Result<Value, String> {
    scryfall.search(query, unique, order, dir, page).await
}

/// All sets, for the Set selector.
#[tauri::command]
async fn scryfall_sets(scryfall: State<'_, Scryfall>) -> Result<Value, String> {
    scryfall.sets().await
}

/// Read a .table or .txt file chosen in the open dialog.
#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    files::read_text(&path)
}

/// Write a .table save or a .txt export chosen in the save dialog.
#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<(), String> {
    files::write_text(&path, &contents)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(Scryfall::new())
        .invoke_handler(tauri::generate_handler![scryfall_search, scryfall_sets, read_text_file, write_text_file])
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
        .expect("error while running Table");
}
