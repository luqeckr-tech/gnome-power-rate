// SPDX-License-Identifier: GPL-2.0-or-later
// SPDX-FileCopyrightText: 2026 Luqman
//
// Power Rate — show battery EnergyRate, ChargeCycles and Capacity from UPower
// in the top bar. Same data as:
//   upower -i "$(upower -e | grep -m1 '/battery_')"
// but read over D-Bus (no subprocess); updates via PropertiesChanged.

import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const UPOWER_BUS = 'org.freedesktop.UPower';
const UPOWER_PATH = '/org/freedesktop/UPower';
const UPOWER_IFACE = 'org.freedesktop.UPower';
const DEVICE_IFACE = 'org.freedesktop.UPower.Device';

// UPower Device.State
const STATE_CHARGING = 1;
const STATE_DISCHARGING = 2;
const STATE_FULLY_CHARGED = 4;
const STATE_PENDING_CHARGE = 5;

const PowerRateIndicator = GObject.registerClass(
class PowerRateIndicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, 'Power Rate', true);

        this._label = new St.Label({
            text: '…',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.add_child(this._label);

        this._proxy = null;
        this._propsId = 0;
        this._cancellable = new Gio.Cancellable();

        this._findBattery();
    }

    _findBattery() {
        Gio.DBus.system.call(
            UPOWER_BUS, UPOWER_PATH, UPOWER_IFACE, 'EnumerateDevices',
            null, new GLib.VariantType('(ao)'),
            Gio.DBusCallFlags.NONE, -1, this._cancellable,
            (conn, res) => {
                let paths;
                try {
                    [paths] = conn.call_finish(res).deepUnpack();
                } catch (e) {
                    if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                        this._label.text = 'UPower?';
                    return;
                }
                // Equivalent to `upower -e | grep -m1 '/battery_'`
                const path = paths.find(p => p.includes('/battery_'));
                if (!path) {
                    this._label.text = 'no bat';
                    return;
                }
                this._connectDevice(path);
            });
    }

    _connectDevice(path) {
        Gio.DBusProxy.new_for_bus(
            Gio.BusType.SYSTEM, Gio.DBusProxyFlags.NONE, null,
            UPOWER_BUS, path, DEVICE_IFACE, this._cancellable,
            (_src, res) => {
                try {
                    this._proxy = Gio.DBusProxy.new_for_bus_finish(res);
                } catch (e) {
                    if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                        this._label.text = 'err';
                    return;
                }
                this._propsId = this._proxy.connect(
                    'g-properties-changed', () => this._update());
                this._update();
            });
    }

    _prop(name) {
        const v = this._proxy?.get_cached_property(name);
        return v ? v.unpack() : null;
    }

    _update() {
        const rate = this._prop('EnergyRate');
        const state = this._prop('State');
        if (rate === null) {
            this._label.text = '?';
            return;
        }

        let sign = '';
        if (state === STATE_CHARGING || state === STATE_PENDING_CHARGE)
            sign = '+';
        else if (state === STATE_DISCHARGING)
            sign = '−';

        const parts = [];
        if (state === STATE_FULLY_CHARGED && rate < 0.05)
            parts.push('⚡ full');
        else
            parts.push(`⚡ ${sign}${rate.toFixed(1)} W`);

        // CC = charge cycles (UPower reports -1/0 when unknown)
        const cycles = this._prop('ChargeCycles');
        if (cycles !== null && cycles > 0)
            parts.push(`CC ${cycles}`);

        // BH = battery health = energy-full / energy-full-design (Capacity property)
        const health = this._prop('Capacity');
        if (health !== null && health > 0)
            parts.push(`BH ${Math.round(health)}%`);

        this._label.text = parts.join(' · ');
    }

    destroy() {
        this._cancellable.cancel();
        if (this._proxy && this._propsId)
            this._proxy.disconnect(this._propsId);
        this._proxy = null;
        super.destroy();
    }
});

export default class PowerRateExtension extends Extension {
    enable() {
        this._indicator = new PowerRateIndicator();
        Main.panel.addToStatusArea(this.uuid, this._indicator, 0, 'right');
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
    }
}
