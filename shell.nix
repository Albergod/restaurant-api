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

  # Levantar el PostgreSQL definido por el proyecto si el puerto está libre.
  if ! (echo >/dev/tcp/127.0.0.1/5432) 2>/dev/null; then
    if docker info >/dev/null 2>&1; then
      echo "→ Iniciando PostgreSQL..."
      docker compose up -d db
    else
      echo "⚠ Docker no está disponible; inicia PostgreSQL manualmente."
    fi
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
