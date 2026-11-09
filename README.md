# Power Rate

GNOME Shell extension that shows battery power info in the top bar:

```
⚡ +45.9 W · CC 49 · BH 92%
```

| Field | Meaning | UPower property |
|---|---|---|
| `+` / `−` W | charging / discharging power | `EnergyRate`, `State` |
| CC | charge cycles | `ChargeCycles` |
| BH | battery health (energy-full ÷ energy-full-design) | `Capacity` |

Data is read directly from UPower over D-Bus (the first `/battery_*` device)
and updates whenever UPower publishes new values — no polling, no subprocesses.
CC or BH is hidden when UPower doesn't report it.

## Install

From [extensions.gnome.org](https://extensions.gnome.org) (once published), or from source:

```sh
git clone https://github.com/luqeckr-tech/gnome-power-rate.git
cd gnome-power-rate
gnome-extensions pack --force
gnome-extensions install --force power-rate@luqeckr-tech.github.io.shell-extension.zip
```

Then log out and back in (required on Wayland) and enable it:

```sh
gnome-extensions enable power-rate@luqeckr-tech.github.io
```

## Requirements

- GNOME Shell 50
- UPower

## License

GPL-2.0-or-later — see [LICENSE](LICENSE).
