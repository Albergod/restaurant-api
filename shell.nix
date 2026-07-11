{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  name = "restaurant-api";

  buildInputs = with pkgs; [
    # Python
    python312
    python312Packages.pip
    python312Packages.virtualenv
    stdenv.cc.cc.lib

    # PostgreSQL cliente (para psql, pg_dump, etc.)
    postgresql

    # Herramientas útiles
    curl
    jq
  ];

  shellHook = ''
  export LD_LIBRARY_PATH=${pkgs.stdenv.cc.cc.lib}/lib:$NIX_LD_LIBRARY_PATH:$LD_LIBRARY_PATH

  # Levantar PostgreSQL si no está corriendo
  if ! docker ps | grep -q restaurant-db; then
    echo "→ Iniciando PostgreSQL..."
    docker run -d \
      --name restaurant-db \
      -e POSTGRES_USER=kaydo \
      -e POSTGRES_PASSWORD=1234 \
      -e POSTGRES_DB=restaurant_db \
      -p 5432:5432 \
      postgres:16 2>/dev/null || docker start restaurant-db
  fi

  # Virtualenv y dependencias
  if [ ! -d .venv ]; then
    virtualenv .venv
  fi
  source .venv/bin/activate
  if [ ! -f .venv/.installed ]; then
    pip install -r requirements.txt --quiet
    touch .venv/.installed
  fi

  if [ ! -f .env ]; then
    cp .env.example .env
  fi

  echo "✓ Listo — uvicorn app.main:app --reload"
'';
}
