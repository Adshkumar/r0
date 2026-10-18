#[tokio::main]
async fn main() {
   if let Err(error) = r0_database::sidecar::run_stdio().await {
      eprintln!("{}", error);
      std::process::exit(1);
   }
}
