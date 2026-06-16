# Estratégia de Backup — BarberAI V3 Final

Este documento detalha os procedimentos de cópia de segurança, retenção e recuperação de desastres para o banco de dados PostgreSQL do BarberAI V3.

---

## 1. Políticas de Backup

### 1.1 Frequência e Janela de Execução
* **Frequência**: Diária.
* **Horário de Execução**: 03:00 (Fuso horário do Servidor), minimizando impacto de rede e performance.
* **Método**: Backup lógico completo via `pg_dump` compactado.

### 1.2 Retenção de Dados
* **Período de Retenção**: 30 dias de backups diários rotativos.
* **Descarte Automatizado**: Backups mais antigos que 30 dias serão deletados automaticamente por regras de ciclo de vida (Lifecycle Rules) no armazenamento de destino.

---

## 2. Armazenamento e Replicação

* **Local Primário**: Armazenamento em bloco temporário local no servidor de backup.
* **Destino Off-site (Nuvem)**: AWS S3 ou Google Cloud Storage (GCS) em bucket privado criptografado com chaves gerenciadas (SSE-S3 ou KMS).
* **Política de Bucket**:
  - Habilitar versionamento de objetos.
  - Lifecycle Policy configurada para expiração em 30 dias.

---

## 3. Roteiro de Automação (Shell Script de Exemplo)

O script abaixo deve ser agendado via `cron` (`0 3 * * *`) no servidor de banco de dados.

```bash
#!/bin/bash

# Configurações
DB_NAME="barberai_prod"
DB_USER="postgres"
BACKUP_DIR="/var/backups/postgres"
DATE=$(date +\%Y-\%m-\%d_\%H-\%M-\%S)
BACKUP_FILE="$BACKUP_DIR/db_backup_${DB_NAME}_${DATE}.sql.gz"
S3_BUCKET="s3://barberai-database-backups"

# Garantir existência do diretório local
mkdir -p "$BACKUP_DIR"

# Executa pg_dump
echo "Iniciando pg_dump para $DB_NAME..."
pg_dump -U "$DB_USER" -h "localhost" "$DB_NAME" | gzip > "$BACKUP_FILE"

# Upload para o S3
echo "Copiando backup para o S3..."
aws s3 cp "$BACKUP_FILE" "$S3_BUCKET/daily/db_backup_${DB_NAME}_${DATE}.sql.gz"

# Limpa backups locais mais velhos que 3 dias
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +3 -exec rm {} \;

echo "Backup concluído com sucesso em $DATE!"
```

---

## 4. Plano de Verificação e Restauração

* **Verificação Semanal**: Um job automatizado em ambiente de Sandbox (Staging) deve baixar o backup mais recente do S3 e restaurá-lo em uma base de testes vazia para garantir a integridade estrutural e de dados.
* **Comando de Restauração**:
  ```bash
  gunzip -c db_backup_barberai_prod_*.sql.gz | psql -U postgres -d barberai_restored
  ```
* **Métricas RPO e RTO**:
  - **RPO (Recovery Point Objective)**: Máximo de 24 horas (perda de dados tolerada).
  - **RTO (Recovery Time Objective)**: Menos de 2 horas para restauração completa em caso de falha catastrófica.
