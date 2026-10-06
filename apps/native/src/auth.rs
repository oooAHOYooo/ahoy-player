use anyhow::{anyhow, bail, Context, Result};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::{Read, Write},
    net::TcpListener,
    path::PathBuf,
    process::Command,
};
use uuid::Uuid;

const CLIENT_ID: &str = "app.ahoy.player";
const REDIRECT_URI: &str = "http://127.0.0.1:3021/callback";

#[derive(Serialize, Deserialize, Default)]
pub struct Auth {
    pub ahoy_id: Option<String>,
    #[serde(default)]
    pub welcome_dismissed: bool,
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    token_type: String,
}

#[derive(Deserialize)]
struct UserInfo {
    sub: String,
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

pub fn start_login_server() -> Result<String> {
    let issuer = std::env::var("AHOY_ID_ISSUER").unwrap_or_else(|_| "https://id.ahoy.ooo".into());
    let issuer = issuer.trim_end_matches('/');
    let listener = TcpListener::bind("127.0.0.1:3021")
        .context("Could not open the AHOY ID callback on 127.0.0.1:3021")?;
    listener.set_nonblocking(false)?;

    let state = random_urlsafe();
    let verifier = format!("{}{}", random_urlsafe(), random_urlsafe());
    let challenge = base64_url(&Sha256::digest(verifier.as_bytes()));
    let login_url = format!(
        "{issuer}/oauth/authorize?response_type=code&client_id={}&redirect_uri={}&scope=openid%20profile&state={}&code_challenge={}&code_challenge_method=S256",
        encode(CLIENT_ID), encode(REDIRECT_URI), encode(&state), encode(&challenge)
    );
    open_browser(&login_url);

    let (mut stream, _) = listener.accept()?;
    let mut buffer = [0; 8192];
    let length = stream.read(&mut buffer)?;
    let request = String::from_utf8_lossy(&buffer[..length]);
    let first_line = request.lines().next().unwrap_or_default();
    let target = first_line
        .strip_prefix("GET ")
        .and_then(|line| line.split_whitespace().next())
        .ok_or_else(|| anyhow!("Invalid callback request"))?;
    let (path, query) = target.split_once('?').unwrap_or((target, ""));
    let params = query_pairs(query)?;
    if path != "/callback" || params.get("state").map(String::as_str) != Some(state.as_str()) {
        write_callback(&mut stream, "Sign-in could not be completed. Return to Ahoy Player and try again.");
        bail!("AHOY ID callback state did not match");
    }
    if let Some(error) = params.get("error") {
        write_callback(&mut stream, "Sign-in was cancelled. You can close this tab.");
        bail!("AHOY ID authorization failed: {error}");
    }
    let code = params.get("code").context("AHOY ID callback did not include a code")?;
    write_callback(&mut stream, "Sign-in complete. You can close this tab and return to Ahoy Player.");

    let token_body = serde_json::json!({
        "grant_type": "authorization_code",
        "code": code,
        "client_id": CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "code_verifier": verifier,
    });
    let token: TokenResponse = curl_json(
        &format!("{issuer}/api/v1/oauth/token"),
        Some(&token_body.to_string()),
        None,
    )?;
    if !token.token_type.eq_ignore_ascii_case("bearer") {
        bail!("AHOY ID returned an unsupported token type");
    }
    let identity: UserInfo = curl_json(
        &format!("{issuer}/api/v1/oauth/userinfo"),
        None,
        Some(&token.access_token),
    )?;
    if identity.sub.trim().is_empty() {
        bail!("AHOY ID returned an empty identity");
    }
    Ok(identity.sub)
}

fn curl_json<T: for<'de> Deserialize<'de>>(url: &str, body: Option<&str>, bearer: Option<&str>) -> Result<T> {
    let mut command = Command::new("curl");
    command.args(["--fail", "--silent", "--show-error", "--max-time", "15"]);
    if let Some(body) = body {
        command.args(["-H", "content-type: application/json", "-d", body]);
    }
    if let Some(token) = bearer {
        command.arg("-H").arg(format!("authorization: Bearer {token}"));
    }
    let output = command.arg(url).output().context("Could not start curl to contact AHOY ID")?;
    if !output.status.success() {
        bail!("AHOY ID request failed: {}", String::from_utf8_lossy(&output.stderr).trim());
    }
    serde_json::from_slice(&output.stdout).context("AHOY ID returned an invalid response")
}

fn open_browser(url: &str) {
    #[cfg(target_os = "windows")]
    let _ = Command::new("cmd").args(["/C", "start", "", url]).spawn();
    #[cfg(target_os = "macos")]
    let _ = Command::new("open").arg(url).spawn();
    #[cfg(target_os = "linux")]
    let _ = Command::new("xdg-open").arg(url).spawn();
}

fn random_urlsafe() -> String {
    Uuid::new_v4().simple().to_string()
}

fn base64_url(bytes: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let mut out = String::new();
    for chunk in bytes.chunks(3) {
        let a = chunk[0] as usize;
        let b = *chunk.get(1).unwrap_or(&0) as usize;
        let c = *chunk.get(2).unwrap_or(&0) as usize;
        out.push(TABLE[a >> 2] as char);
        out.push(TABLE[((a & 3) << 4) | (b >> 4)] as char);
        if chunk.len() > 1 { out.push(TABLE[((b & 15) << 2) | (c >> 6)] as char); }
        if chunk.len() > 2 { out.push(TABLE[c & 63] as char); }
    }
    out
}

fn encode(value: &str) -> String {
    value.bytes().map(|byte| {
        if byte.is_ascii_alphanumeric() || b"-._~".contains(&byte) { (byte as char).to_string() }
        else { format!("%{byte:02X}") }
    }).collect()
}

fn query_pairs(query: &str) -> Result<std::collections::HashMap<String, String>> {
    let mut result = std::collections::HashMap::new();
    for pair in query.split('&').filter(|pair| !pair.is_empty()) {
        let (key, value) = pair.split_once('=').unwrap_or((pair, ""));
        result.insert(decode(key)?, decode(value)?);
    }
    Ok(result)
}

fn decode(value: &str) -> Result<String> {
    let bytes = value.as_bytes();
    let mut result = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' {
            let hex = std::str::from_utf8(bytes.get(index + 1..index + 3).context("Invalid URL encoding")?)?;
            result.push(u8::from_str_radix(hex, 16).context("Invalid URL encoding")?);
            index += 3;
        } else {
            result.push(if bytes[index] == b'+' { b' ' } else { bytes[index] });
            index += 1;
        }
    }
    Ok(String::from_utf8(result).context("Invalid UTF-8 in callback")?)
}

fn write_callback(stream: &mut std::net::TcpStream, message: &str) {
    let body = format!("<!doctype html><meta charset=utf-8><title>Ahoy Player</title><h1>Ahoy Player</h1><p>{message}</p>");
    let response = format!("HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nCache-Control: no-store\r\nConnection: close\r\nContent-Length: {}\r\n\r\n{}", body.len(), body);
    let _ = stream.write_all(response.as_bytes());
}
