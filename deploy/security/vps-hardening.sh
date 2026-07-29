#!/usr/bin/env bash
# VPS hardening for car-service demo host.
# Does NOT change SSH password auth settings.
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo bash $0"
  exit 1
fi

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y fail2ban unattended-upgrades

cat >/etc/fail2ban/jail.d/car-service.local <<'JAIL'
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5
backend = systemd

[sshd]
enabled = true
port = ssh,1315
maxretry = 4
bantime = 2h
JAIL

cat >/etc/sysctl.d/99-car-service-security.conf <<'SYSCTL'
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.secure_redirects = 0
net.ipv4.conf.default.secure_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv6.conf.default.accept_redirects = 0
net.ipv4.tcp_syncookies = 1
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.conf.all.log_martians = 1
SYSCTL

sysctl --system >/dev/null
systemctl enable fail2ban unattended-upgrades
systemctl restart fail2ban

# App secrets on disk (adjust paths)
for f in /opt/car-service-ai-assistant/backend/.env /opt/car-service-ai-assistant/.env.proxmox; do
  [[ -f "$f" ]] && chmod 600 "$f"
done

echo "VPS hardening applied. SSH password settings unchanged."
