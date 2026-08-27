// Live smoke: drive the REAL kernel's emergency stop from the companion core.
fn main() {
    let k = jarvis_companion_core::DEFAULT_KERNEL;
    println!("healthy: {:?}", jarvis_companion_core::is_healthy(k));
    println!("engage:  {:?}", jarvis_companion_core::engage_estop(k));
    println!("engaged after engage: {:?}", jarvis_companion_core::estop_engaged(k));
    println!("resume:  {:?}", jarvis_companion_core::resume_estop(k));
    println!("engaged after resume: {:?}", jarvis_companion_core::estop_engaged(k));
}
