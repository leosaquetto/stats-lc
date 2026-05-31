#!/bin/zsh

set -e

cd "$(dirname "$0")"

APP_URL="http://localhost:3000/"

clear
echo "Stats LC"
echo "Diretorio: $(pwd)"
echo

if lsof -ti tcp:3000 >/dev/null 2>&1; then
  echo "O servidor ja esta aberto em $APP_URL"
  open "$APP_URL"
  echo
  read -k 1 "?Pressione qualquer tecla para fechar esta janela."
  echo
  exit 0
fi

if [[ ! -d node_modules ]]; then
  echo "Instalando dependencias pela primeira vez..."
  npm install
  echo
fi

echo "Abrindo $APP_URL"
echo "Para encerrar o servidor, pressione Control + C."
echo

(sleep 2 && open "$APP_URL") &

npm run dev
