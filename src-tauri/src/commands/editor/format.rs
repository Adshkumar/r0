use r0_tooling::{FormatRequest, FormatResponse};
use tauri::command;

/// Format code content using the specified formatter
#[command]
#[specta::specta]
pub async fn format_code(request: FormatRequest) -> Result<FormatResponse, String> {
   r0_tooling::format_code(&request)
}
