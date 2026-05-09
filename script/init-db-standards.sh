#!/bin/bash
# ============================================
# 规范标准数据初始化脚本
# ============================================
# 用法:
#   bash init-db-standards.sh              # 使用默认连接参数（localhost:5433）
#   bash init-db-standards.sh --prod       # 使用 .env 中的连接参数
#   bash init-db-standards.sh -h HOST -p PORT -u USER -d DB
#
# 说明:
#   - 仅执行 seed_standards.sql（标准+条文+检查点）
#   - 幂等，可重复执行
# ============================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SEED_SQL="$SCRIPT_DIR/backend/seed_standards.sql"

# 默认连接参数（对应 docker-compose 端口映射）
DB_HOST="localhost"
DB_PORT="5433"
DB_NAME="doc_generator"
DB_USER="archspec"

# 解析参数
while [[ $# -gt 0 ]]; do
    case "$1" in
        --prod)
            # 从 .env / .env.pro 读取
            ENV_FILE="$SCRIPT_DIR/../deploy/docker/.env.pro"
            if [[ -f "$ENV_FILE" ]]; then
                source <(grep -E '^POSTGRES_' "$ENV_FILE" | sed 's/^/export /')
                DB_HOST="${POSTGRES_HOST:-postgres}"
                DB_PORT="${POSTGRES_PORT:-5433}"
                DB_NAME="${POSTGRES_DB:-doc_generator}"
                DB_USER="${POSTGRES_USER:-archspec}"
            else
                echo "Error: .env.pro not found at $ENV_FILE"
                exit 1
            fi
            ;;
        --dev)
            ENV_FILE="$SCRIPT_DIR/../deploy/docker/.env"
            if [[ -f "$ENV_FILE" ]]; then
                source <(grep -E '^POSTGRES_' "$ENV_FILE" | sed 's/^/export /')
                DB_HOST="${POSTGRES_HOST:-postgres}"
                DB_PORT="${POSTGRES_PORT:-5433}"
                DB_NAME="${POSTGRES_DB:-doc_generator}"
                DB_USER="${POSTGRES_USER:-archspec}"
            fi
            ;;
        -h) DB_HOST="$2"; shift ;;
        -p) DB_PORT="$2"; shift ;;
        -u) DB_USER="$2"; shift ;;
        -d) DB_NAME="$2"; shift ;;
        -w) PGPASSWORD="$2"; shift ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--prod|--dev] [-h HOST] [-p PORT] [-u USER] [-d DB] [-w PASSWORD]"
            exit 1
            ;;
    esac
    shift
done

# 密码从环境变量或 .env 读取
if [[ -z "${PGPASSWORD:-}" ]]; then
    # 尝试读取密码
    if [[ -f "$SCRIPT_DIR/../deploy/docker/.env" ]]; then
        PGPASSWORD=$(grep '^POSTGRES_PASSWORD=' "$SCRIPT_DIR/../deploy/docker/.env" | cut -d'=' -f2-)
        export PGPASSWORD
    fi
fi

echo "========================================"
echo "  ArchSpec 规范标准数据初始化"
echo "========================================"
echo "  Host: $DB_HOST:$DB_PORT"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo "  SQL: $SEED_SQL"
echo "========================================"

if [[ ! -f "$SEED_SQL" ]]; then
    echo "Error: Seed SQL file not found: $SEED_SQL"
    exit 1
fi

echo "Executing seed SQL..."

# 优先通过 docker exec 执行（无需本地安装 psql）
CONTAINER=$(docker ps --filter "name=archspec-postgres" --format "{{.Names}}" 2>/dev/null || true)

if [[ -n "$CONTAINER" ]]; then
    echo "Using Docker container: $CONTAINER"
    docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" < "$SEED_SQL"
elif command -v psql &>/dev/null; then
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SEED_SQL"
else
    echo "Error: Neither Docker container found nor psql installed."
    echo "  Start the DB first: cd deploy/docker && docker-compose up -d postgres"
    echo "  Or install psql client and try again."
    exit 1
fi

echo ""
echo "Done! Standards, clauses, and checkpoints initialized successfully."
