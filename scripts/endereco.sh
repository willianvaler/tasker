#!/usr/bin/env bash
# Endereço provisório (*.trycloudflare.com) do tasker-quick, lido das métricas do cloudflared
# (o log do systemd pode já ter sido rotacionado).
for port in 20241 20242 20243 20244 20245; do
  host=$(curl -s --max-time 2 "localhost:$port/quicktunnel" | sed -n 's/.*"hostname":"\([^"]*\)".*/\1/p')
  if [ -n "$host" ]; then echo "https://$host"; exit 0; fi
done
echo "tasker-quick sem endereço (systemctl --user status tasker-quick)" >&2
exit 1
