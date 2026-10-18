use url::Url;

fn main() {
    for uri in [
        "file:///Users/example/Projects/R0",
        "file:///Users/example/Projects/Other%20Project",
        "file:///C:/Users/example/Projects/R0",
        "vscode-remote://ssh-remote+host/home/sw/app",
    ] {
        let parsed = Url::parse(uri);
        println!("{uri} => {parsed:?}");
        if let Ok(url) = parsed {
            println!("  file path: {:?}", url.to_file_path());
        }
    }
}
