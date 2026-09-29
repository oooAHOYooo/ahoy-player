use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Default)]
pub struct Auth {
    pub ahoy_id: Option<String>,
    #[serde(default)]
    pub welcome_dismissed: bool,
}

pub fn load(path: &PathBuf) -> Result<Auth> {
    if !path.exists() {
        return Ok(Auth::default());
    }
    let data = fs::read_to_string(path)?;
    let auth: Auth = serde_json::from_str(&data)?;
    Ok(auth)
}

pub fn save(path: &PathBuf, auth: &Auth) -> Result<()> {
    let data = serde_json::to_string_pretty(auth)?;
    fs::write(path, data)?;
    Ok(())
}

pub fn open_browser(url: &str) {
    #[cfg(target_os = "windows")]
    let _ = std::process::Command::new("cmd").args(["/C", "start", url]).spawn();
    #[cfg(target_os = "macos")]
    let _ = std::process::Command::new("open").arg(url).spawn();
    #[cfg(target_os = "linux")]
    let _ = std::process::Command::new("xdg-open").arg(url).spawn();
}

pub fn start_login_server() -> Result<String> {
    use std::io::{Read, Write};
    use std::net::TcpListener;

    let listener = TcpListener::bind("127.0.0.1:3021")?;
    
    // Open the browser
    open_browser("https://id.ahoy.ooo/login?client_id=ahoy-player&redirect_uri=http://127.0.0.1:3021/callback");

    for stream in listener.incoming() {
        if let Ok(mut stream) = stream {
            let mut buffer = [0; 1024];
            if stream.read(&mut buffer).is_ok() {
                let request = String::from_utf8_lossy(&buffer);
                if let Some(line) = request.lines().next() {
                    // line is "GET /callback?ahoy_id=123 HTTP/1.1"
                    if line.starts_with("GET /callback") {
                        if let Some(start) = line.find("ahoy_id=") {
                            let part = &line[start + 8..];
                            let end = part.find(' ').unwrap_or(part.len());
                            let end = part[..end].find('&').unwrap_or(end);
                            let ahoy_id = part[..end].to_string();
                            
                            let response = "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n<html><body><h1>Logged in!</h1><p>You can close this window and return to Ahoy Player.</p><script>setTimeout(() => window.close(), 3000)</script></body></html>";
                            let _ = stream.write_all(response.as_bytes());
                            return Ok(ahoy_id);
                        }
                    }
                }
            }
            let response = "HTTP/1.1 400 Bad Request\r\n\r\nBad Request";
            let _ = stream.write_all(response.as_bytes());
        }
    }
    
    anyhow::bail!("Server closed without getting auth");
}
