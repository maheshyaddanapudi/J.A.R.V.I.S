# kernel/src/devices — device-control HAL (Phase 5 foundation)

Typed device gateway with a labeled SIMULATION backend and a real Home Assistant
backend, plus the physical-safety gating the goal's "device control" requires.

## Files
- `contract.ts` — `DeviceGateway`: listDevices/getState (READ_ONLY), apply
  (command). `DEVICE_RISK` maps type → risk: lights/media/climate/blinds =
  CONSEQUENTIAL; locks/garage/utilities = HIGH_RISK_PHYSICAL. Every result
  carries `provenance` (REAL|SIMULATION).
- `simulator.ts` — `StarkResidence`: labeled SIMULATION over a real mutable
  virtual home (lights, thermostat, blinds, media, front lock, garage, water
  valve). Verification reads back actual state. Never a real device.
- `interlock.ts` — `InterlockManager`: HIGH_RISK_PHYSICAL actions need an
  independent, single-use, time-boxed (30s) hardware interlock IN ADDITION to
  approval (R-AUTO-01). On the Mac it can be backed by a real physical control
  behind the same interface.
- `tools.ts` — device.list/state (READ_ONLY), device.set (CONSEQUENTIAL;
  discloses HIGH_RISK_PHYSICAL + consumes the interlock for locks/garage/
  utilities; rollback captured), device.armInterlock (LOW_REVERSIBLE).
- `homeassistant.ts` — REAL adapter (HA REST API, Apache-2.0). LAN-only; token
  from the vault at call time. Provenance REAL. Builds on the Mac.

## Verified (2026-07-17)
9 device tests (88 kernel total). Live through the gated loop: light approved →
on (verified); lock unlock REFUSED without an armed interlock; armed + approved →
succeeds; single-use interlock refuses the second attempt. Emergency stop halts
device commands (the loop's estop check precedes execution).

## GATE (docs/06) — D-0025
Binding the REAL Home Assistant gateway requires the "before enabling physical-
device control" check-in. In-container the SIMULATION gateway is used; the real
adapter is injected via `buildCore({devices})` only on the Mac after approval.

## Next (after the check-in)
Real HA pairing, device registry persistence, Matter/MQTT/Zigbee adapters,
room model, energy/anomaly monitoring, the Home Control interface mode.
