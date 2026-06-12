# =============================================================================
# DUMP DE BASE DE DATOS SCORECARD
# =============================================================================
# Genera un archivo SQL portátil con TODO el contenido de la BD scorecard:
# schema (tablas, vistas, triggers, funciones), datos, y constraints.
#
# El archivo resultante se puede restaurar en otra instalación de PostgreSQL
# con un solo comando psql.
#
# Salida: scorecard_backup_YYYY-MM-DD_HHMMSS.sql en el directorio actual.
# =============================================================================

$ErrorActionPreference = "Stop"

# --- Configuración: ajusta si tu setup local es diferente ---
$PgBin     = "C:\Program Files\PostgreSQL\18\bin"
$PgHost    = "127.0.0.1"
$PgPort    = "5432"
$PgUser    = "scorecard_app"
$PgDb      = "scorecard"

$timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$outFile   = "scorecard_backup_$timestamp.sql"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host " Dump de base de datos scorecard"            -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Origen:      $PgUser@$PgHost`:$PgPort/$PgDb"
Write-Host "Archivo:     $outFile"
Write-Host ""

# Flags explicados:
#   --no-owner          : no incluye comandos OWNER TO; al restaurar, el nuevo
#                         usuario será owner. Útil cuando el usuario destino
#                         es distinto del origen.
#   --no-privileges     : no incluye GRANT/REVOKE. El nuevo entorno define
#                         sus propios permisos.
#   --clean --if-exists : el archivo restaurado primero DROP de objetos
#                         existentes (idempotente: re-restaurar sobre BD
#                         poblada no falla).
#   --quote-all-identifiers : evita conflictos con palabras reservadas
#                              (la columna 'dec' en metric_validity es un
#                              caso conocido).
#   -f                  : archivo de salida.

& "$PgBin\pg_dump.exe" `
    -h $PgHost `
    -p $PgPort `
    -U $PgUser `
    -d $PgDb `
    --no-owner `
    --no-privileges `
    --clean `
    --if-exists `
    --quote-all-identifiers `
    -f $outFile

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: pg_dump falló con código $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}

$size = (Get-Item $outFile).Length
$sizeKB = [Math]::Round($size / 1024, 1)
$sizeMB = [Math]::Round($size / 1024 / 1024, 2)

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host " Dump completado"                              -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host "Archivo:     $outFile"
Write-Host "Tamaño:      $sizeKB KB ($sizeMB MB)"
Write-Host ""
Write-Host "Para verificar que el archivo no está vacío:"  -ForegroundColor Yellow
Write-Host "  Get-Content $outFile | Select-Object -First 30"
Write-Host ""
Write-Host "Para restaurar en el destino (después de crear la BD y usuario):" -ForegroundColor Yellow
Write-Host "  psql -U scorecard_app -d scorecard -h <host_destino> -f $outFile"
Write-Host ""