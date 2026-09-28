import logging
import os
import shutil
import subprocess
import threading
import time
from datetime import datetime, timezone

import psutil

logger = logging.getLogger("system-metrics")

THROTTLE_BITS = {
    0: "under_voltage_now",
    1: "freq_capped_now",
    2: "throttled_now",
    3: "soft_temp_limit_now",
    16: "under_voltage_occurred",
    17: "freq_capped_occurred",
    18: "throttled_occurred",
    19: "soft_temp_limit_occurred",
}

ARM_CPU_PARTS = {
    "0xb76": "ARM1176JZF-S",   # Pi 1, Zero
    "0xc07": "ARM Cortex-A7",  # Pi 2 v1.1
    "0xd03": "ARM Cortex-A53", # Pi 3, Zero 2 W
    "0xd08": "ARM Cortex-A72", # Pi 4, Pi 400
    "0xd0b": "ARM Cortex-A76", # Pi 5
}


def _read(path):
    try:
        with open(path) as f:
            return f.read().strip().rstrip("\x00")
    except OSError:
        return None


def _cpuinfo_field(name):
    for line in (_read("/proc/cpuinfo") or "").splitlines():
        key, _, value = line.partition(":")
        if key.strip() == name:
            return value.strip()
    return None


def _pi_model():
    return _read("/proc/device-tree/model") or _cpuinfo_field("Model")


def _cpu_model():
    part = _cpuinfo_field("CPU part")
    if part:
        return ARM_CPU_PARTS.get(part.lower(), f"ARM (part {part})")
    return _cpuinfo_field("model name") 


def _os_info():
    for path, source in (("/host/etc/os-release", "host"), ("/etc/os-release", "container_or_host")):
        text = _read(path)
        if text:
            for line in text.splitlines():
                if line.startswith("PRETTY_NAME="):
                    return {"name": line.split("=", 1)[1].strip('"'), "source": source}
    return {"name": None, "source": None}


def _vcgencmd(*args):
    if not shutil.which("vcgencmd"):
        return None
    try:
        r = subprocess.run(["vcgencmd", *args], capture_output=True, text=True, timeout=2)
        return r.stdout.strip() if r.returncode == 0 else None
    except (OSError, subprocess.TimeoutExpired):
        return None


def _throttling():
    raw = None
    out = _vcgencmd("get_throttled")  # "throttled=0x50000"
    if out and "=" in out:
        raw = out.split("=", 1)[1]
    else:
        raw = _read("/sys/devices/platform/soc/soc:firmware/get_throttled")
    if not raw:
        return None
    try:
        value = int(raw, 16)
    except ValueError:
        return None
    return {"raw": hex(value), **{n: bool(value >> b & 1) for b, n in THROTTLE_BITS.items()}}


def _cpu_temp_c():
    raw = _read("/sys/class/thermal/thermal_zone0/temp")
    try:
        return round(int(raw) / 1000, 1) if raw else None
    except ValueError:
        return None


def format_uptime(seconds):
    days, rem = divmod(int(seconds), 86400)
    hours, rem = divmod(rem, 3600)
    minutes, secs = divmod(rem, 60)
    return f"{days}d {hours:02d}:{minutes:02d}:{secs:02d}"


class MetricsCollector:
    def __init__(self, interval=2.0, disk_path="/"):
        self.interval = interval
        self.disk_path = disk_path
        self._lock = threading.Lock()
        self._snapshot = None
        self._thread = None
        self._prev_net = None
        self._prev_t = None
        mem_total = psutil.virtual_memory().total
        self.static = {
            "model": _pi_model(),
            "cpu": _cpu_model(),
            "cpu_cores": psutil.cpu_count(logical=True),
            "ram": f"{mem_total / 2**30:.1f} GiB",
            "ram_total_mb": mem_total // 2**20,
        }
        os_info = _os_info()
        self.static["os"] = os_info["name"]
        self.static["os_source"] = os_info["source"] 

    def start(self):
        if self._thread is not None:
            return
        psutil.cpu_percent(interval=None)
        psutil.cpu_percent(interval=None, percpu=True)
        self._prev_net = psutil.net_io_counters()
        self._prev_t = time.monotonic()
        time.sleep(0.5)
        self._store(self._sample()) 
        self._thread = threading.Thread(target=self._run, name="metrics", daemon=True)
        self._thread.start()
        logger.info("Metrics collector started | interval=%.1fs", self.interval)

    def _run(self):
        while True:
            time.sleep(self.interval)
            try:
                self._store(self._sample())
            except Exception:
                logger.exception("Metrics sampling failed")

    def _store(self, snap):
        with self._lock:
            self._snapshot = snap  

    def snapshot(self):
        with self._lock:
            return self._snapshot

    def _sample(self):
        now = time.monotonic()
        window = now - self._prev_t
        net = psutil.net_io_counters()
        rx = (net.bytes_recv - self._prev_net.bytes_recv) * 8 / 1000 / window
        tx = (net.bytes_sent - self._prev_net.bytes_sent) * 8 / 1000 / window
        self._prev_net, self._prev_t = net, now

        freq = psutil.cpu_freq()
        mem = psutil.virtual_memory()
        swap = psutil.swap_memory()
        disk = psutil.disk_usage(self.disk_path)

        return {
            "sampled_at": datetime.now(timezone.utc).isoformat(),
            "sample_window_s": round(window, 2),
            "cpu": {
                "percent_total": psutil.cpu_percent(interval=None),
                "percent_per_core": psutil.cpu_percent(interval=None, percpu=True),
                "load_avg_1_5_15": [round(x, 2) for x in os.getloadavg()],
                "freq_mhz": round(freq.current) if freq else None,
                "temp_c": _cpu_temp_c(),
                "throttling": _throttling(),
            },
            "memory": {
                "available_mb": mem.available // 2**20,
                "used_percent": mem.percent,
                "swap_used_percent": swap.percent,
            },
            "disk": {
                "path": self.disk_path,
                "total_gb": round(disk.total / 2**30, 1),
                "free_gb": round(disk.free / 2**30, 1),
                "used_percent": disk.percent,
            },
            "network": {"rx_kbps": round(rx, 2), "tx_kbps": round(tx, 2)},
        }
