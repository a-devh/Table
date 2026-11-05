//! Reading and writing the user's files: .table saves and text exports.
//! Paths come from the native open/save dialogs.

use std::fs;
use std::path::Path;

const ALLOWED: [&str; 2] = ["table", "txt"];

fn check_extension(path: &Path) -> Result<(), String> {
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_ascii_lowercase();
    if ALLOWED.contains(&ext.as_str()) {
        Ok(())
    } else {
        Err(format!("Table only reads and writes .table and .txt files, not \"{}\".", path.display()))
    }
}

pub fn read_text(path: &str) -> Result<String, String> {
    let path = Path::new(path);
    check_extension(path)?;
    fs::read_to_string(path).map_err(|e| format!("Couldn't open {}: {e}", path.display()))
}

/// Writes to a temporary file next to the target, then renames it over the
/// target, so a crash mid-save never leaves a half-written file.
pub fn write_text(path: &str, contents: &str) -> Result<(), String> {
    let path = Path::new(path);
    check_extension(path)?;
    let tmp = path.with_extension("saving");
    fs::write(&tmp, contents).map_err(|e| format!("Couldn't save {}: {e}", path.display()))?;
    fs::rename(&tmp, path).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        format!("Couldn't save {}: {e}", path.display())
    })
}
