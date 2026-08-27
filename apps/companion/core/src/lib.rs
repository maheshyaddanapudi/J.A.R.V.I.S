//! jarvis-companion-core — platform-independent logic for the macOS companion.
//!
//! The Tauri shell (menu-bar EMERGENCY STOP, global push-to-talk hotkey, the
//! Command Center window) is macOS-built and can't compile in the Linux dev
//! container. This crate holds the part that CAN: a tiny std-only client to the
//! **local** kernel over loopback, so the companion's emergency stop and status
//! checks call the REAL kernel (`/core/estop/*`, `/health`) — no mock. Loopback
//! only (R-LOC-01); no external crates, so it is compiled + unit-tested off the Mac.

use std::io::{Read, Write};
use std::net::TcpStream;
use std::time::Duration;

/// Default loopback address of the kernel (R-LOC-01: never a non-loopback bind).
pub const DEFAULT_KERNEL: &str = "127.0.0.1:4150";

#[derive(Debug)]
pub enum KernelError {
    Connect(std::io::Error),
    Io(std::io::Error),
    /// Non-2xx HTTP status (or an unparseable status line, reported as 0).
    Status(u16),
}

impl std::fmt::Display for KernelError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            KernelError::Connect(e) => write!(f, "kernel unreachable: {e}"),
            KernelError::Io(e) => write!(f, "kernel I/O error: {e}"),
            KernelError::Status(s) => write!(f, "kernel returned HTTP {s}"),
        }
    }
}
impl std::error::Error for KernelError {}

/// Engage the persistent emergency stop (menu-bar item / global hotkey).
pub fn engage_estop(addr: &str) -> Result<(), KernelError> {
    post(addr, "/core/estop/engage", "{\"via\":\"companion\"}").map(|_| ())
}

/// Resume after an emergency stop.
pub fn resume_estop(addr: &str) -> Result<(), KernelError> {
    post(addr, "/core/estop/resume", "{\"via\":\"companion\"}").map(|_| ())
}

/// True when the kernel is reachable and reports healthy.
pub fn is_healthy(addr: &str) -> Result<bool, KernelError> {
    let body = get(addr, "/health")?;
    Ok(body.contains("\"status\":\"ok\""))
}

/// True when the emergency stop is currently engaged (best-effort parse).
pub fn estop_engaged(addr: &str) -> Result<bool, KernelError> {
    let body = get(addr, "/core/estop")?;
    Ok(body.contains("\"engaged\":true"))
}

fn post(addr: &str, path: &str, json: &str) -> Result<String, KernelError> {
    request(addr, "POST", path, Some(json))
}
fn get(addr: &str, path: &str) -> Result<String, KernelError> {
    request(addr, "GET", path, None)
}

/// Minimal HTTP/1.1 request over a fresh loopback TCP connection (Connection: close).
fn request(addr: &str, method: &str, path: &str, body: Option<&str>) -> Result<String, KernelError> {
    let mut stream = TcpStream::connect(addr).map_err(KernelError::Connect)?;
    stream.set_read_timeout(Some(Duration::from_secs(5))).ok();
    stream.set_write_timeout(Some(Duration::from_secs(5))).ok();

    let mut req = format!("{method} {path} HTTP/1.1\r\nHost: {addr}\r\nConnection: close\r\n");
    if let Some(b) = body {
        req.push_str("Content-Type: application/json\r\n");
        req.push_str(&format!("Content-Length: {}\r\n", b.len()));
    }
    req.push_str("\r\n");
    if let Some(b) = body {
        req.push_str(b);
    }

    stream.write_all(req.as_bytes()).map_err(KernelError::Io)?;
    let mut resp = String::new();
    stream.read_to_string(&mut resp).map_err(KernelError::Io)?;

    let status = parse_status(&resp).unwrap_or(0);
    if !(200..300).contains(&status) {
        return Err(KernelError::Status(status));
    }
    Ok(resp.splitn(2, "\r\n\r\n").nth(1).unwrap_or("").to_string())
}

/// Parse the HTTP status code from the status line.
fn parse_status(resp: &str) -> Option<u16> {
    resp.lines().next()?.split_whitespace().nth(1)?.parse().ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_status_line() {
        assert_eq!(parse_status("HTTP/1.1 200 OK\r\n\r\n{}"), Some(200));
        assert_eq!(parse_status("HTTP/1.1 503 Service Unavailable\r\n"), Some(503));
        assert_eq!(parse_status("garbage"), None);
    }

    #[test]
    fn health_and_estop_bodies_parse() {
        // body-shape checks that back is_healthy / estop_engaged
        assert!("{\"status\":\"ok\",\"service\":\"kernel\"}".contains("\"status\":\"ok\""));
        assert!("{\"engaged\":true}".contains("\"engaged\":true"));
        assert!(!"{\"engaged\":false}".contains("\"engaged\":true"));
    }

    #[test]
    fn unreachable_kernel_is_a_connect_error() {
        // port 1 is not listening on loopback → a clean Connect error, never a panic
        let err = engage_estop("127.0.0.1:1").unwrap_err();
        matches!(err, KernelError::Connect(_));
    }
}
